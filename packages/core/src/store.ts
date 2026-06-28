import type { ConceptType, Encounter, Link, LinkType } from '@memoris/shared';
import type { StorageAdapter } from './adapter.js';
import type { CaptureInput, Clock, LookupResult, StoredConcept } from './types.js';
import { systemClock } from './types.js';
import { normalizeKey } from './text.js';
import { nearest, cosineSimilarity } from './vector.js';
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

  // --- Dedup / merge / linking (Phase 2 — the moat) ---

  /**
   * Link a set of concepts that were saved from the SAME encounter as `co-occurs` (pairwise).
   * This is real co-occurrence in the user's own work, not a generic ontology
   * (docs/ARCHITECTURE.md §9).
   */
  async linkCoOccurrence(conceptIds: string[]): Promise<Link[]> {
    const unique = [...new Set(conceptIds)];
    const links: Link[] = [];
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        links.push(await this.addLink(unique[i]!, unique[j]!, 'co-occurs'));
      }
    }
    return links;
  }

  /**
   * Find near-duplicate concept pairs by embedding similarity (high threshold). Candidates for
   * merge; the UI / a rubric decides whether to actually merge.
   */
  async findDuplicatePairs(threshold = 0.95): Promise<{ a: StoredConcept; b: StoredConcept; similarity: number }[]> {
    const concepts = (await this.adapter.listConcepts()).filter((c) => c.embedding?.length);
    const pairs: { a: StoredConcept; b: StoredConcept; similarity: number }[] = [];
    for (let i = 0; i < concepts.length; i++) {
      for (let j = i + 1; j < concepts.length; j++) {
        const a = concepts[i]!;
        const b = concepts[j]!;
        const sim = cosineSimilarity(a.embedding!, b.embedding!);
        if (sim >= threshold) pairs.push({ a, b, similarity: sim });
      }
    }
    return pairs;
  }

  /**
   * Merge `dupId` into `targetId`: combine encounters/counts, repoint encounters & links, delete
   * the duplicate. Returns the surviving concept.
   */
  async mergeConcepts(targetId: string, dupId: string): Promise<StoredConcept> {
    if (targetId === dupId) throw new Error('cannot merge a concept into itself');
    const target = await this.adapter.getConcept(targetId);
    const dup = await this.adapter.getConcept(dupId);
    if (!target || !dup) throw new Error('concept not found');

    const mergedEncounterIds = [...new Set([...target.encounterIds, ...dup.encounterIds])];
    target.encounterIds = mergedEncounterIds;
    target.encounterCount += dup.encounterCount;
    if (!target.embedding && dup.embedding) target.embedding = dup.embedding;

    // Repoint the duplicate's encounters at the survivor.
    for (const id of dup.encounterIds) {
      const e = await this.adapter.getEncounter(id);
      if (e && e.conceptId === dupId) {
        e.conceptId = targetId;
        await this.adapter.putEncounter(e);
      }
    }

    // Repoint links, dropping any that would become self-links or duplicates.
    for (const link of await this.adapter.listLinks()) {
      let changed = false;
      if (link.fromConceptId === dupId) {
        link.fromConceptId = targetId;
        changed = true;
      }
      if (link.toConceptId === dupId) {
        link.toConceptId = targetId;
        changed = true;
      }
      if (changed) await this.adapter.putLink(link);
    }

    await this.adapter.putConcept(target);
    await this.adapter.deleteConcept(dupId);
    return target;
  }

  // --- Review (Phase 3) ---

  /** Concepts due for a contextual micro-review now. */
  async dueReviews(now = this.clock.now()): Promise<StoredConcept[]> {
    const concepts = await this.adapter.listConcepts();
    return concepts.filter((c) => isDue(c.review, now));
  }

  /** Due concepts, most-overdue first — the review queue order. */
  async reviewQueue(now = this.clock.now()): Promise<StoredConcept[]> {
    const due = await this.dueReviews(now);
    return due.sort((a, b) => {
      const ta = a.review.nextReview ? Date.parse(a.review.nextReview) : 0;
      const tb = b.review.nextReview ? Date.parse(b.review.nextReview) : 0;
      return ta - tb;
    });
  }

  /**
   * Build a review card: the concept plus a real source encounter to replay ("Today's review is
   * from your real GitHub PR" — docs/ROADMAP.md Phase 3). Picks the most recent encounter.
   */
  async buildReviewCard(conceptId: string): Promise<{ concept: StoredConcept; source?: Encounter } | undefined> {
    const concept = await this.adapter.getConcept(conceptId);
    if (!concept) return undefined;
    const encounters = await this.conceptEncounters(conceptId);
    encounters.sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));
    return { concept, source: encounters[0] };
  }

  /** Weak concepts (low mastery) — candidates for targeted review. */
  async weakConcepts(threshold = 0.4): Promise<StoredConcept[]> {
    const concepts = await this.adapter.listConcepts();
    return concepts
      .filter((c) => c.review.mastery < threshold)
      .sort((a, b) => a.review.mastery - b.review.mastery);
  }

  /** Confusion pairs — concepts linked `confused-with`, for paired/targeted review. */
  async confusionPairs(): Promise<{ a: StoredConcept; b: StoredConcept }[]> {
    const links = (await this.adapter.listLinks()).filter((l) => l.type === 'confused-with');
    const out: { a: StoredConcept; b: StoredConcept }[] = [];
    for (const l of links) {
      const a = await this.adapter.getConcept(l.fromConceptId);
      const b = await this.adapter.getConcept(l.toConceptId);
      if (a && b) out.push({ a, b });
    }
    return out;
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
