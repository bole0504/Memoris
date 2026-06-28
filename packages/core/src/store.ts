import type { ConceptType, Encounter, Link, LinkType } from '@memoris/shared';
import type { StorageAdapter } from './adapter.js';
import type { CaptureInput, Clock, LookupResult, StoredConcept } from './types.js';
import { systemClock } from './types.js';
import { normalizeKey } from './text.js';
import { nearest } from './vector.js';
import { decideCuration, type CurationVerdict } from './curation.js';
import { applyReExposure, applyReview, initialReviewState, isDue, type ReviewGrade } from './review.js';

export interface MemoryStoreOptions {
  adapter: StorageAdapter;
  clock?: Clock;
  genId?: () => string;
  /** Cosine threshold above which a Tier-1 neighbor counts as "the same idea". */
  tier1Threshold?: number;
}

export interface RememberInput {
  /** The lookup encounter to attach (so we don't double-log). */
  encounterId: string;
  /** Canonical text of the concept (may be a unit extracted from a paragraph). */
  text: string;
  type?: ConceptType;
  gloss?: string;
  embedding?: number[];
  language?: string;
  /** When saving onto an existing/related concept instead of creating one. */
  attachToConceptId?: string;
}

export interface BrainStats {
  concepts: number;
  encounters: number;
  /** Concepts due for review now. */
  dueReviews: number;
  /** Most-encountered concepts (the "translated N×" leaderboard). */
  topConcepts: { id: string; text: string; encounterCount: number }[];
}

/**
 * The brain's high-level operations. Surface-agnostic; all persistence goes through the adapter.
 */
export class MemoryStore {
  private readonly adapter: StorageAdapter;
  private readonly clock: Clock;
  private readonly genId: () => string;
  private readonly tier1Threshold: number;

  constructor(opts: MemoryStoreOptions) {
    this.adapter = opts.adapter;
    this.clock = opts.clock ?? systemClock;
    this.genId = opts.genId ?? (() => crypto.randomUUID());
    this.tier1Threshold = opts.tier1Threshold ?? 0.82;
  }

  /**
   * Resolve a selection against the local brain. ALWAYS logs an encounter — even on a hit — because
   * the "you've translated this N×" signal comes from counting encounters, not AI calls
   * (docs/ARCHITECTURE.md §2). An optional embedding enables Tier-1 semantic search.
   */
  async lookup(input: CaptureInput, embedding?: number[]): Promise<LookupResult> {
    const now = this.clock.now();
    const encounter: Encounter = {
      id: this.genId(),
      selection: input.selection,
      surroundingContext: input.surroundingContext,
      source: input.source,
      capturedAt: now.toISOString(),
      lowContext: input.lowContext ?? false,
    };

    // Tier 0 — exact-match cache.
    const key = normalizeKey(input.selection);
    const exact = await this.adapter.getConceptByKey(key);
    if (exact) {
      encounter.conceptId = exact.id;
      await this.adapter.putEncounter(encounter);
      exact.encounterCount += 1;
      exact.encounterIds.push(encounter.id);
      exact.review = applyReExposure(exact.review, now);
      await this.adapter.putConcept(exact);
      return { encounter, tier: 0, concept: exact };
    }

    // Tier 1 — semantic search (needs an embedding; the server provides it).
    await this.adapter.putEncounter(encounter);
    if (embedding && embedding.length > 0) {
      const concepts = await this.adapter.listConcepts();
      const hit = nearest(embedding, concepts, this.tier1Threshold);
      if (hit) {
        return { encounter, tier: 1, concept: hit.item, similarity: hit.similarity };
      }
    }

    return { encounter, tier: 'miss' };
  }

  /** Curation verdict for a selection — "worth remembering?" (docs/ARCHITECTURE.md §4). */
  async curate(input: CaptureInput, embedding?: number[]): Promise<CurationVerdict> {
    const key = normalizeKey(input.selection);
    const exact = await this.adapter.getConceptByKey(key);
    if (exact) return decideCuration({ selection: input.selection, exact });

    if (embedding && embedding.length > 0) {
      const concepts = await this.adapter.listConcepts();
      const hit = nearest(embedding, concepts, this.tier1Threshold);
      if (hit) {
        return decideCuration({
          selection: input.selection,
          related: { concept: hit.item, similarity: hit.similarity },
        });
      }
    }
    return decideCuration({ selection: input.selection });
  }

  /**
   * One-tap "Remember this." Attaches the lookup encounter to a concept — a brand-new one, or an
   * existing/related concept the user chose to reinforce.
   */
  async remember(input: RememberInput): Promise<StoredConcept> {
    const now = this.clock.now();
    const encounter = await this.adapter.getEncounter(input.encounterId);
    if (!encounter) throw new Error(`encounter ${input.encounterId} not found`);

    if (input.attachToConceptId) {
      const concept = await this.adapter.getConcept(input.attachToConceptId);
      if (!concept) throw new Error(`concept ${input.attachToConceptId} not found`);
      encounter.conceptId = concept.id;
      await this.adapter.putEncounter(encounter);
      if (!concept.encounterIds.includes(encounter.id)) {
        concept.encounterIds.push(encounter.id);
        concept.encounterCount += 1;
      }
      concept.review = applyReExposure(concept.review, now);
      if (input.embedding && !concept.embedding) concept.embedding = input.embedding;
      await this.adapter.putConcept(concept);
      return concept;
    }

    const concept: StoredConcept = {
      id: this.genId(),
      text: input.text,
      key: normalizeKey(input.text),
      type: input.type ?? 'term',
      language: input.language ?? 'en',
      gloss: input.gloss,
      encounterCount: 1,
      encounterIds: [encounter.id],
      firstSeen: now.toISOString(),
      review: initialReviewState(now),
      embedding: input.embedding,
    };
    encounter.conceptId = concept.id;
    await this.adapter.putEncounter(encounter);
    await this.adapter.putConcept(concept);
    return concept;
  }

  async getConcept(id: string): Promise<StoredConcept | undefined> {
    return this.adapter.getConcept(id);
  }

  async listConcepts(): Promise<StoredConcept[]> {
    return this.adapter.listConcepts();
  }

  /** Encounters that gave rise to / re-saw a concept — the source context for review replay. */
  async conceptEncounters(conceptId: string): Promise<Encounter[]> {
    const concept = await this.adapter.getConcept(conceptId);
    if (!concept) return [];
    const out: Encounter[] = [];
    for (const id of concept.encounterIds) {
      const e = await this.adapter.getEncounter(id);
      if (e) out.push(e);
    }
    return out;
  }

  /** Add a typed link between two concepts (dedup on from/to/type). */
  async addLink(fromConceptId: string, toConceptId: string, type: LinkType, weight?: number): Promise<Link> {
    const existing = (await this.adapter.listLinks()).find(
      (l) => l.fromConceptId === fromConceptId && l.toConceptId === toConceptId && l.type === type,
    );
    if (existing) return existing;
    const link: Link = { id: this.genId(), fromConceptId, toConceptId, type, weight };
    await this.adapter.putLink(link);
    return link;
  }

  async listLinks(): Promise<Link[]> {
    return this.adapter.listLinks();
  }

  // --- Review (Phase 3) ---

  /** Concepts due for a contextual micro-review now. */
  async dueReviews(now = this.clock.now()): Promise<StoredConcept[]> {
    const concepts = await this.adapter.listConcepts();
    return concepts.filter((c) => isDue(c.review, now));
  }

  /** Record the outcome of a review and reschedule. */
  async gradeReview(conceptId: string, grade: ReviewGrade): Promise<StoredConcept> {
    const concept = await this.adapter.getConcept(conceptId);
    if (!concept) throw new Error(`concept ${conceptId} not found`);
    concept.review = applyReview(concept.review, grade, this.clock.now());
    await this.adapter.putConcept(concept);
    return concept;
  }

  // --- Stats (dashboard) ---

  async stats(): Promise<BrainStats> {
    const [concepts, encounters] = await Promise.all([
      this.adapter.listConcepts(),
      this.adapter.listEncounters(),
    ]);
    const now = this.clock.now();
    const topConcepts = [...concepts]
      .sort((a, b) => b.encounterCount - a.encounterCount)
      .slice(0, 10)
      .map((c) => ({ id: c.id, text: c.text, encounterCount: c.encounterCount }));
    return {
      concepts: concepts.length,
      encounters: encounters.length,
      dueReviews: concepts.filter((c) => isDue(c.review, now)).length,
      topConcepts,
    };
  }
}
