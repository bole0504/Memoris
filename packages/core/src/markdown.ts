import type { Encounter, Link } from '@memoris/shared';
import type { BrainExport, StoredConcept } from './types.js';

/**
 * Obsidian projection: one markdown file per Concept (docs/ARCHITECTURE.md §8). Obsidian's native
 * Graph View turns the [[wikilinks]] between concept notes into the user's vocabulary graph.
 *
 * CRITICAL (roadmap risk #2): the round-trip must be LOSSLESS. The AI owns everything ABOVE the
 * managed marker; the user's notes below it are sacred and never overwritten.
 */

export const MANAGED_MARKER = '<!-- memoris:managed-above — edit freely below, never touched -->';
const USER_NOTES_HEADING = '## Your notes';

/** A related concept to wikilink to. */
export interface RelatedRef {
  text: string;
  relation: 'related' | 'co-occurs' | 'confused-with';
}

function relationFor(linkType: Link['type']): RelatedRef['relation'] {
  if (linkType === 'co-occurs') return 'co-occurs';
  if (linkType === 'confused-with') return 'confused-with';
  return 'related';
}

/**
 * Compute the wikilink targets for a concept from the typed links (both directions). Pure, so both
 * the live bridge and JSON import can reuse it.
 */
export function buildRelatedRefs(
  conceptId: string,
  links: Link[],
  conceptsById: Map<string, StoredConcept>,
): RelatedRef[] {
  const out: RelatedRef[] = [];
  const seen = new Set<string>();
  for (const l of links) {
    let otherId: string | undefined;
    if (l.fromConceptId === conceptId) otherId = l.toConceptId;
    else if (l.toConceptId === conceptId) otherId = l.fromConceptId;
    if (!otherId || seen.has(otherId)) continue;
    const other = conceptsById.get(otherId);
    if (!other) continue;
    seen.add(otherId);
    out.push({ text: other.text, relation: relationFor(l.type) });
  }
  return out;
}

/** Obsidian-safe note name (no path/link-breaking chars), used as filename and wikilink target. */
export function conceptSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\\/:*?"<>|#^[\]]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function conceptFilename(text: string): string {
  return `${conceptSlug(text)}.md`;
}

function wikilink(text: string): string {
  const slug = conceptSlug(text);
  return slug === text.toLowerCase() ? `[[${slug}]]` : `[[${slug}|${text}]]`;
}

function escapeYaml(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function frontmatter(concept: StoredConcept, related: RelatedRef[]): string {
  const confused = related.filter((r) => r.relation === 'confused-with').map((r) => wikilink(r.text));
  const rel = related.filter((r) => r.relation !== 'confused-with').map((r) => wikilink(r.text));
  const lines = [
    '---',
    `concept: ${escapeYaml(concept.text)}`,
    `type: ${concept.type}`,
    `language: ${concept.language}`,
    `mastery: ${concept.review.mastery.toFixed(2)}`,
    `encounters: ${concept.encounterCount}`,
    `first_seen: ${concept.firstSeen.slice(0, 10)}`,
  ];
  if (concept.review.lastReview) lines.push(`last_review: ${concept.review.lastReview.slice(0, 10)}`);
  if (concept.review.nextReview) lines.push(`next_review: ${concept.review.nextReview.slice(0, 10)}`);
  lines.push('tags: [memoris]');
  if (rel.length) lines.push(`related: [${rel.map(escapeYaml).join(', ')}]`);
  if (confused.length) lines.push(`confused_with: [${confused.map(escapeYaml).join(', ')}]`);
  lines.push('---');
  return lines.join('\n');
}

/** Render the AI-managed portion of a concept note (frontmatter + body up to the marker). */
export function renderManaged(
  concept: StoredConcept,
  encounters: Encounter[],
  related: RelatedRef[],
): string {
  const out: string[] = [frontmatter(concept, related), '', `# ${concept.text}`];
  if (concept.gloss) out.push('', `**Gloss:** ${concept.gloss}`);

  if (encounters.length) {
    out.push('', '## Encounters');
    for (const e of [...encounters].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))) {
      const date = e.capturedAt.slice(0, 10);
      out.push(`- ${date} · ${e.source.app} · "${e.selection.replace(/\s+/g, ' ').trim()}"`);
    }
  }

  if (related.length) {
    out.push('', '## Related');
    for (const r of related) out.push(`- ${wikilink(r.text)} _(${r.relation})_`);
  }

  out.push('', MANAGED_MARKER);
  return out.join('\n');
}

/** The default user-notes section appended to a brand-new note. */
function defaultUserSection(): string {
  return `\n\n${USER_NOTES_HEADING}\n\n`;
}

/**
 * Full note for a new concept (managed part + empty user section).
 */
export function renderConceptNote(
  concept: StoredConcept,
  encounters: Encounter[],
  related: RelatedRef[],
): string {
  return renderManaged(concept, encounters, related) + defaultUserSection();
}

/**
 * Lossless merge: regenerate the managed part, but preserve the user's section verbatim from the
 * existing file. Everything from the marker onward in `existing` is kept exactly.
 */
export function mergeConceptNote(
  existing: string,
  concept: StoredConcept,
  encounters: Encounter[],
  related: RelatedRef[],
): string {
  const managed = renderManaged(concept, encounters, related);

  const markerIdx = existing.indexOf(MANAGED_MARKER);
  if (markerIdx !== -1) {
    // Keep everything AFTER the marker (the user's region) byte-for-byte.
    const userPart = existing.slice(markerIdx + MANAGED_MARKER.length);
    return managed + userPart;
  }

  // No marker (hand-made or pre-marker file): preserve from the user-notes heading if present,
  // otherwise keep the whole existing file below a fresh managed block so nothing is lost.
  const headingIdx = existing.indexOf(USER_NOTES_HEADING);
  if (headingIdx !== -1) {
    return managed + '\n\n' + existing.slice(headingIdx);
  }
  return managed + '\n\n' + USER_NOTES_HEADING + '\n\n' + existing.trim() + '\n';
}

/** One projected vault file. */
export interface ProjectedFile {
  path: string;
  content: string;
  /** True when an existing note was merged (vs newly created). */
  merged: boolean;
}

/**
 * Project an entire brain export into Obsidian markdown files (one per concept), preserving any
 * existing user notes via the lossless merge. Pure given `readExisting`, so it's fully testable —
 * the plugin just supplies vault read/write IO around it.
 */
export function projectBrain(
  data: BrainExport,
  folder: string,
  readExisting: (path: string) => string | undefined,
): ProjectedFile[] {
  const conceptsById = new Map(data.concepts.map((c) => [c.id, c]));
  const encById = new Map(data.encounters.map((e) => [e.id, e]));
  const prefix = folder ? `${folder.replace(/\/+$/, '')}/` : '';

  return data.concepts.map((concept) => {
    const related = buildRelatedRefs(concept.id, data.links, conceptsById);
    const encounters = concept.encounterIds
      .map((id) => encById.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e));
    const path = `${prefix}${conceptFilename(concept.text)}`;
    const existing = readExisting(path);
    const content = existing
      ? mergeConceptNote(existing, concept, encounters, related)
      : renderConceptNote(concept, encounters, related);
    return { path, content, merged: existing !== undefined };
  });
}
