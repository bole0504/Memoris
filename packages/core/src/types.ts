import type { Concept, Encounter, IsoDateTime } from '@memoris/shared';

export type { Concept, Encounter, Link, Source, ConceptType, LinkType } from '@memoris/shared';

/**
 * A Concept as stored by the brain: the shared Concept plus a normalized `key` used for the
 * Tier-0 exact-match cache (docs/ARCHITECTURE.md §2).
 */
export interface StoredConcept extends Concept {
  /** Normalized exact-match key (lowercased, trimmed, collapsed whitespace). */
  key: string;
  /**
   * Encounters this concept originated from / was re-seen in. A paragraph encounter can be shared
   * by several concepts, so this is concept-side (many concepts ↔ one encounter). Used to replay
   * the original source in review (docs/ARCHITECTURE.md §5).
   */
  encounterIds: string[];
}

/** Injectable clock so tests are deterministic (Date.now is banned in some runtimes). */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** What a single capture provides before it becomes an Encounter. */
export interface CaptureInput {
  selection: string;
  surroundingContext?: string;
  source: Encounter['source'];
  lowContext?: boolean;
}

/** Result of a brain lookup for a selection. */
export interface LookupResult {
  /** The encounter that was logged for this lookup (always created). */
  encounter: Encounter;
  /** Tier that resolved it. */
  tier: 0 | 1 | 2 | 'miss';
  /** Existing concept if Tier-0/1 found one. */
  concept?: StoredConcept;
  /** Cosine similarity for a Tier-1 hit. */
  similarity?: number;
}

/** A portable snapshot of the whole brain — for export → Obsidian import / backup. */
export interface BrainExport {
  version: 1;
  exportedAt: IsoDateTime;
  concepts: StoredConcept[];
  encounters: Encounter[];
  links: import('@memoris/shared').Link[];
}

export type { StorageAdapter } from './adapter.js';
export type { CurationVerdict } from './curation.js';
export type { ReviewGrade } from './review.js';
