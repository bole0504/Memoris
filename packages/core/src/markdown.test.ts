import { describe, it, expect } from 'vitest';
import {
  conceptSlug,
  conceptFilename,
  renderConceptNote,
  mergeConceptNote,
  projectBrain,
  MANAGED_MARKER,
  type RelatedRef,
} from './markdown.js';
import type { BrainExport, StoredConcept } from './types.js';
import type { Encounter } from '@memoris/shared';

function concept(text: string, over: Partial<StoredConcept> = {}): StoredConcept {
  return {
    id: 'c1',
    text,
    key: text.toLowerCase(),
    type: 'term',
    language: 'en',
    gloss: 'safe to repeat without extra effect',
    encounterCount: 3,
    encounterIds: ['e1'],
    firstSeen: '2026-03-02T10:00:00.000Z',
    review: { mastery: 0.4, nextReview: '2026-06-29T00:00:00.000Z' },
    ...over,
  };
}

function enc(selection: string, app = 'GitHub'): Encounter {
  return {
    id: 'e1',
    selection,
    source: { id: 's', app, domain: 'github.com', url: 'https://github.com/x/pull/1' },
    capturedAt: '2026-03-02T10:00:00.000Z',
    lowContext: false,
  };
}

describe('markdown projection', () => {
  it('slug + filename are Obsidian-safe', () => {
    expect(conceptSlug('Eventual Consistency')).toBe('eventual-consistency');
    expect(conceptSlug('C#/Foo: bar?')).toBe('cfoo-bar');
    expect(conceptFilename('idempotent')).toBe('idempotent.md');
  });

  it('renders frontmatter, encounters, and wikilinks for the graph', () => {
    const related: RelatedRef[] = [
      { text: 'retry logic', relation: 'co-occurs' },
      { text: 'atomic', relation: 'confused-with' },
    ];
    const md = renderConceptNote(concept('idempotent'), [enc('make it idempotent')], related);
    expect(md).toContain('concept: "idempotent"');
    expect(md).toContain('encounters: 3');
    expect(md).toContain('## Encounters');
    expect(md).toContain('GitHub · "make it idempotent"');
    expect(md).toContain('[[retry-logic|retry logic]]'); // wikilink → graph edge
    expect(md).toContain('confused_with: ["[[atomic]]"]');
    expect(md).toContain('## Your notes');
  });
});

describe('lossless round-trip (roadmap risk #2)', () => {
  it('preserves the user notes section byte-for-byte on re-sync', () => {
    const first = renderConceptNote(concept('idempotent'), [enc('make it idempotent')], []);
    // User edits their section.
    const edited = first.replace(
      '## Your notes\n\n',
      '## Your notes\n\nMy mnemonic: "press the button twice, same result." 🔁\n',
    );

    // Re-sync with new data (more encounters, mastery changed).
    const resynced = mergeConceptNote(
      edited,
      concept('idempotent', { encounterCount: 7, review: { mastery: 0.8 } }),
      [enc('make it idempotent'), enc('idempotency keys', 'Stripe docs')],
      [],
    );

    expect(resynced).toContain('My mnemonic: "press the button twice, same result." 🔁');
    expect(resynced).toContain('encounters: 7'); // managed part updated
    expect(resynced).toContain('mastery: 0.80');
    expect(resynced).toContain('Stripe docs · "idempotency keys"');
    // The user's text appears exactly once and exactly as written.
    expect(resynced.match(/My mnemonic/g)).toHaveLength(1);
  });

  it('never loses content from a marker-less hand-made file', () => {
    const handMade = '# idempotent\n\nThoughts I wrote before installing Memoris.\n';
    const merged = mergeConceptNote(handMade, concept('idempotent'), [], []);
    expect(merged).toContain(MANAGED_MARKER);
    expect(merged).toContain('Thoughts I wrote before installing Memoris.');
  });
});

describe('projectBrain (whole-vault projection for the graph)', () => {
  const data: BrainExport = {
    version: 1,
    exportedAt: '2026-06-28T00:00:00.000Z',
    concepts: [
      concept('idempotent', { id: 'a', key: 'idempotent', encounterIds: ['e1'] }),
      concept('retry logic', { id: 'b', key: 'retry logic', encounterIds: ['e1'] }),
    ],
    encounters: [enc('use idempotent retry logic')],
    links: [{ id: 'l1', fromConceptId: 'a', toConceptId: 'b', type: 'co-occurs' }],
  };

  it('emits one file per concept with wikilinks wiring the graph', () => {
    const files = projectBrain(data, 'Memoris', () => undefined);
    expect(files.map((f) => f.path).sort()).toEqual(['Memoris/idempotent.md', 'Memoris/retry-logic.md']);
    const a = files.find((f) => f.path.endsWith('idempotent.md'))!;
    expect(a.content).toContain('[[retry-logic|retry logic]]'); // edge a → b
    expect(a.merged).toBe(false);
  });

  it('merges into existing notes, preserving user sections', () => {
    const existingA = renderConceptNote(data.concepts[0]!, [enc('use idempotent retry logic')], []).replace(
      '## Your notes\n\n',
      '## Your notes\n\nkeep me\n',
    );
    const files = projectBrain(data, 'Memoris', (p) => (p.endsWith('idempotent.md') ? existingA : undefined));
    const a = files.find((f) => f.path.endsWith('idempotent.md'))!;
    expect(a.merged).toBe(true);
    expect(a.content).toContain('keep me');
  });
});
