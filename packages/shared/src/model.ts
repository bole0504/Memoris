/**
 * Core data model — the four object types (docs/ARCHITECTURE.md §8).
 *
 * Encounter  — a single capture event (immutable log). A selected paragraph lives here.
 * Concept    — the durable, reviewable unit. Many encounters → one concept.
 * Link       — a typed edge between concepts.
 * Source     — where a capture came from (GitHub/Slack/...), for context replay in review.
 */

/** ISO-8601 timestamp string, e.g. "2026-06-28T10:00:00.000Z". */
export type IsoDateTime = string;

/** The kind of durable unit a Concept represents. */
export type ConceptType = 'term' | 'phrase' | 'idiom' | 'collocation' | 'grammar' | 'idea';

/** Typed edges — intentionally NOT Obsidian's mushy bidirectional link. */
export type LinkType =
  | 'is-a'
  | 'confused-with'
  | 'co-occurs'
  | 'prerequisite-of'
  | 'synonym-of';

/**
 * Where a capture happened. Metadata only — never store URLs/identifiers that leak secrets
 * (docs/ARCHITECTURE.md §6).
 */
export interface Source {
  /** Stable id. */
  id: string;
  /** Human label, e.g. "GitHub", "Stripe docs", "Slack". */
  app: string;
  /** Registrable domain, e.g. "github.com". */
  domain: string;
  /** Full URL of the page the capture happened on (omitted in privacy mode). */
  url?: string;
  /** Page/issue/PR title when available. */
  title?: string;
}

/**
 * A single capture event. Immutable. The "translated this 6×" signal is derived by counting
 * Encounters for a Concept — even on cache hits (docs/ARCHITECTURE.md §2).
 */
export interface Encounter {
  id: string;
  /** Concept this encounter is attached to, once curation has assigned one. */
  conceptId?: string;
  /** The exact text the user selected. For a paragraph, the whole paragraph. */
  selection: string;
  /** Minimal surrounding text for context — never the whole page. */
  surroundingContext?: string;
  /** Source of the capture. */
  source: Source;
  /** When the capture happened. */
  capturedAt: IsoDateTime;
  /**
   * True when full page context was unavailable (privacy mode, canvas-rendered apps).
   * AI analysis is more generic for these (docs/ARCHITECTURE.md §6).
   */
  lowContext: boolean;
}

/** Review/scheduling state carried by a Concept (filled from Phase 3 on). */
export interface ReviewState {
  /** 0..1 — how well the user knows this. */
  mastery: number;
  /** When this concept is next due for a micro-review. */
  nextReview?: IsoDateTime;
  /** When it was last reviewed. */
  lastReview?: IsoDateTime;
}

/**
 * The durable, reviewable unit. Carries an embedding (added in Phase 2), mastery, review state.
 */
export interface Concept {
  id: string;
  /** Canonical surface form, e.g. "idempotent". */
  text: string;
  type: ConceptType;
  /** BCP-47 language tag of the concept, e.g. "en". */
  language: string;
  /** One-line gloss shown in the popover. */
  gloss?: string;
  /** How many times the user has encountered this (denormalized for the hook). */
  encounterCount: number;
  firstSeen: IsoDateTime;
  review: ReviewState;
  /** Vector embedding — added in Phase 2 (IndexedDB v0, sqlite-vec later). */
  embedding?: number[];
}

/** A typed edge between two concepts. */
export interface Link {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  type: LinkType;
  /** Confidence/weight 0..1 (e.g. embedding similarity for `co-occurs`). */
  weight?: number;
}
