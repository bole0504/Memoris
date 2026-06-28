import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from './store.js';
import { InMemoryAdapter } from './memory-adapter.js';
import type { Clock, CaptureInput } from './types.js';
import { cosineSimilarity, nearest } from './vector.js';
import { normalizeKey } from './text.js';
import { applyReview, applyReExposure, initialReviewState, isDue } from './review.js';

// Deterministic clock + id generator so tests never flake.
function fixedClock(start = new Date('2026-06-01T00:00:00.000Z')): Clock & { advance(ms: number): void } {
  let t = start.getTime();
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function seqId() {
  let n = 0;
  return () => `id-${++n}`;
}

function capture(selection: string, extra?: Partial<CaptureInput>): CaptureInput {
  return {
    selection,
    source: { id: 's1', app: 'github.com', domain: 'github.com', url: 'https://github.com/x/y/pull/1' },
    ...extra,
  };
}

describe('text + vector utils', () => {
  it('normalizeKey collapses case/space/trailing punctuation', () => {
    expect(normalizeKey('  Idempotent. ')).toBe('idempotent');
    expect(normalizeKey('make  it\nidempotent')).toBe('make it idempotent');
  });

  it('cosineSimilarity: identical=1, orthogonal=0', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('nearest respects the threshold', () => {
    const items = [{ embedding: [1, 0] }, { embedding: [0, 1] }];
    expect(nearest([1, 0.01], items, 0.9)?.item).toBe(items[0]);
    expect(nearest([0.6, 0.6], items, 0.95)).toBeUndefined();
  });
});

describe('review scheduler', () => {
  it('grading good schedules a future review and raises mastery', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const s0 = initialReviewState(now);
    const s1 = applyReview(s0, 'good', now);
    expect(s1.mastery).toBeGreaterThan(s0.mastery);
    expect(new Date(s1.nextReview!).getTime()).toBeGreaterThan(now.getTime());
  });

  it('again drops mastery and makes it due very soon', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const s = applyReview({ mastery: 0.5 }, 'again', now);
    expect(s.mastery).toBeLessThan(0.5);
  });

  it('re-exposure pushes next review out (the world is teaching it)', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    const s0 = applyReview(initialReviewState(now), 'good', now);
    const s1 = applyReExposure(s0, now);
    expect(new Date(s1.nextReview!).getTime()).toBeGreaterThanOrEqual(
      new Date(s0.nextReview!).getTime(),
    );
    expect(s1.mastery).toBeGreaterThan(s0.mastery);
  });

  it('isDue is true once nextReview has passed', () => {
    const now = new Date('2026-06-01T00:00:00Z');
    expect(isDue({ mastery: 0, nextReview: '2026-05-01T00:00:00Z' }, now)).toBe(true);
    expect(isDue({ mastery: 0, nextReview: '2026-07-01T00:00:00Z' }, now)).toBe(false);
  });
});

describe('MemoryStore — capture loop', () => {
  let store: MemoryStore;
  let clock: ReturnType<typeof fixedClock>;

  beforeEach(() => {
    clock = fixedClock();
    store = new MemoryStore({ adapter: new InMemoryAdapter(), clock, genId: seqId() });
  });

  it('lookup always logs an encounter, even on a miss', async () => {
    const r = await store.lookup(capture('idempotent'));
    expect(r.tier).toBe('miss');
    expect(r.encounter.id).toBeTruthy();
    const stats = await store.stats();
    expect(stats.encounters).toBe(1);
    expect(stats.concepts).toBe(0);
  });

  it('remember creates a concept linked to the lookup encounter', async () => {
    const r = await store.lookup(capture('idempotent'));
    const c = await store.remember({ encounterId: r.encounter.id, text: 'idempotent', gloss: 'safe to repeat' });
    expect(c.encounterCount).toBe(1);
    expect(c.encounterIds).toContain(r.encounter.id);
    const encs = await store.conceptEncounters(c.id);
    expect(encs).toHaveLength(1);
    expect(encs[0]!.selection).toBe('idempotent');
  });

  it('Tier-0: re-seeing an exact concept increments the "seen N×" count', async () => {
    const r1 = await store.lookup(capture('idempotent'));
    await store.remember({ encounterId: r1.encounter.id, text: 'idempotent' });

    // Same term again (different spacing/case) → Tier-0 hit, count grows.
    const r2 = await store.lookup(capture('  Idempotent '));
    expect(r2.tier).toBe(0);
    expect(r2.concept!.encounterCount).toBe(2);

    const verdict = await store.curate(capture('idempotent'));
    expect(verdict.status).toBe('seen');
    expect(verdict.seenCount).toBe(2); // curate does not log; count reflects the 2 prior lookups
  });

  it('Tier-1: a semantically close selection finds the existing concept', async () => {
    const r1 = await store.lookup(capture('idempotent'), [1, 0, 0]);
    await store.remember({ encounterId: r1.encounter.id, text: 'idempotent', embedding: [1, 0, 0] });

    const r2 = await store.lookup(capture('idempotency'), [0.98, 0.02, 0]);
    expect(r2.tier).toBe(1);
    expect(r2.concept!.text).toBe('idempotent');
    expect(r2.similarity!).toBeGreaterThan(0.9);
  });

  it('curation: new vs related vs seen', async () => {
    expect((await store.curate(capture('webhook'))).status).toBe('new');

    const r = await store.lookup(capture('idempotent'), [1, 0, 0]);
    await store.remember({ encounterId: r.encounter.id, text: 'idempotent', embedding: [1, 0, 0] });

    const related = await store.curate(capture('idempotently'), [0.95, 0.05, 0]);
    expect(related.status).toBe('related');
    expect(related.relatedConceptText).toBe('idempotent');
  });

  it('typed links dedup on (from,to,type)', async () => {
    const r1 = await store.lookup(capture('affect'));
    const a = await store.remember({ encounterId: r1.encounter.id, text: 'affect' });
    const r2 = await store.lookup(capture('effect'));
    const b = await store.remember({ encounterId: r2.encounter.id, text: 'effect' });
    await store.addLink(a.id, b.id, 'confused-with');
    await store.addLink(a.id, b.id, 'confused-with');
    expect(await store.listLinks()).toHaveLength(1);
  });

  it('co-occurrence: units saved from one capture get pairwise co-occurs links', async () => {
    const r = await store.lookup(capture('use idempotent retry logic'));
    const a = await store.remember({ encounterId: r.encounter.id, text: 'idempotent' });
    const b = await store.remember({ encounterId: r.encounter.id, text: 'retry logic' });
    await store.linkCoOccurrence([a.id, b.id]);
    const links = await store.listLinks();
    expect(links).toHaveLength(1);
    expect(links[0]!.type).toBe('co-occurs');
  });

  it('dedup: finds near-duplicate concepts by embedding and merges them', async () => {
    const r1 = await store.lookup(capture('idempotent'), [1, 0, 0]);
    const a = await store.remember({ encounterId: r1.encounter.id, text: 'idempotent', embedding: [1, 0, 0] });
    const r2 = await store.lookup(capture('idempotence'));
    const b = await store.remember({ encounterId: r2.encounter.id, text: 'idempotence', embedding: [0.999, 0.01, 0] });

    const pairs = await store.findDuplicatePairs(0.95);
    expect(pairs).toHaveLength(1);

    const merged = await store.mergeConcepts(a.id, b.id);
    expect(merged.encounterCount).toBe(2);
    expect(await store.getConcept(b.id)).toBeUndefined();
    const encs = await store.conceptEncounters(a.id);
    expect(encs).toHaveLength(2);
  });

  it('merge repoints links from the duplicate onto the survivor', async () => {
    const r1 = await store.lookup(capture('affect'));
    const a = await store.remember({ encounterId: r1.encounter.id, text: 'affect' });
    const r2 = await store.lookup(capture('effect'));
    const b = await store.remember({ encounterId: r2.encounter.id, text: 'effect' });
    const r3 = await store.lookup(capture('efect'));
    const dup = await store.remember({ encounterId: r3.encounter.id, text: 'efect' });
    await store.addLink(a.id, dup.id, 'confused-with');

    await store.mergeConcepts(b.id, dup.id);
    const links = await store.listLinks();
    expect(links).toHaveLength(1);
    expect(links[0]!.toConceptId).toBe(b.id);
  });

  it('review lifecycle: a saved concept becomes due, then reschedules on grade', async () => {
    const r = await store.lookup(capture('idempotent'));
    const c = await store.remember({ encounterId: r.encounter.id, text: 'idempotent' });
    expect(await store.dueReviews()).toHaveLength(0); // first review ~tomorrow

    clock.advance(2 * 24 * 60 * 60 * 1000); // +2 days
    const due = await store.dueReviews();
    expect(due.map((x) => x.id)).toContain(c.id);

    const graded = await store.gradeReview(c.id, 'good');
    expect(graded.review.mastery).toBeGreaterThan(0);
    expect(await store.dueReviews()).toHaveLength(0); // pushed into the future
  });
});
