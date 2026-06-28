import type { StoredConcept } from './types.js';
import { wordCount } from './text.js';

export type CurationStatus = 'new' | 'seen' | 'related';

/**
 * The curation verdict surfaced in the popover — "worth remembering?" is the whole product
 * (docs/ARCHITECTURE.md §4, critical-path risk #1). This is the heuristic v1: novelty (embedding
 * distance) + frequency. The server can layer an LLM rubric on top for borderline cases.
 */
export interface CurationVerdict {
  status: CurationStatus;
  /** Whether to nudge the user to save (the one-tap "Remember this"). */
  shouldPromptSave: boolean;
  /** One-line message for the popover. */
  message: string;
  /** Novelty 0..1 (1 = totally new). */
  novelty: number;
  /** For `seen`: how many times this exact concept has been encountered. */
  seenCount?: number;
  /** For `related`: the concept it's close to. */
  relatedConceptId?: string;
  relatedConceptText?: string;
}

export interface CurationInput {
  selection: string;
  /** Tier-0 exact-match hit, if any. */
  exact?: StoredConcept;
  /** Tier-1 nearest neighbor above threshold, if any. */
  related?: { concept: StoredConcept; similarity: number };
}

/**
 * Decide what to tell the user about a selection. Pure + deterministic.
 */
export function decideCuration(input: CurationInput): CurationVerdict {
  const { selection, exact, related } = input;

  if (exact) {
    const seenCount = exact.encounterCount;
    return {
      status: 'seen',
      // Already in the brain — the value is the "you've seen this" hook, not re-saving.
      shouldPromptSave: false,
      seenCount,
      novelty: 0,
      message:
        seenCount >= 2
          ? `Seen ${seenCount}× before — already in your memory.`
          : `Already saved — seen ${seenCount}×.`,
    };
  }

  if (related) {
    const novelty = clamp01(1 - related.similarity);
    return {
      status: 'related',
      shouldPromptSave: true,
      novelty,
      relatedConceptId: related.concept.id,
      relatedConceptText: related.concept.text,
      message: `Related to “${related.concept.text}” you saved — save this too?`,
    };
  }

  // Brand new. Paragraphs are context, not one concept — phrase the prompt accordingly.
  const isParagraph = wordCount(selection) > 12;
  return {
    status: 'new',
    shouldPromptSave: true,
    novelty: 1,
    message: isParagraph ? 'New passage — save the key terms?' : 'New concept — save it?',
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
