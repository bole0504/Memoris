import type { MemoryStore, CaptureInput, CurationVerdict, StoredConcept } from '@memoris/core';
import type { AnalyzeResponse, ProposedUnit } from '@memoris/shared';

/**
 * The Phase 1 capture loop, decoupled from React so it can be unit-tested in Node:
 *   select → analyze (translate + gloss + units) + embed → log encounter → curation verdict.
 * Then `rememberUnit` saves a chosen unit with its source context.
 */
export interface CaptureDeps {
  analyze: (
    text: string,
    targetLanguage: string,
    context?: string,
    signal?: AbortSignal,
  ) => Promise<AnalyzeResponse>;
  embed: (text: string, signal?: AbortSignal) => Promise<number[]>;
  brain: MemoryStore;
  targetLanguage: string;
}

export interface CaptureState {
  selection: string;
  encounterId: string;
  tier: 0 | 1 | 2 | 'miss';
  analysis: AnalyzeResponse;
  verdict: CurationVerdict;
  /** Embedding of the whole selection (undefined if embedding failed/offline). */
  embedding?: number[];
  /** Existing concept if Tier-0/1 matched. */
  concept?: StoredConcept;
}

export async function runCapture(
  input: CaptureInput,
  deps: CaptureDeps,
  signal?: AbortSignal,
): Promise<CaptureState> {
  // Translate (latency-critical) and embed in parallel. Embedding is best-effort: if it fails
  // (offline / quota), the loop still works — we just lose Tier-1 for this lookup.
  const [analysis, embedding] = await Promise.all([
    deps.analyze(input.selection, deps.targetLanguage, input.surroundingContext, signal),
    deps.embed(input.selection, signal).catch(() => undefined),
  ]);

  const lookup = await deps.brain.lookup(input, embedding);
  const verdict = await deps.brain.curate(input, embedding);

  return {
    selection: input.selection,
    encounterId: lookup.encounter.id,
    tier: lookup.tier,
    analysis,
    verdict,
    embedding,
    concept: lookup.concept,
  };
}

/** Save a proposed unit as a concept, attached to the capture's encounter (its source context). */
export async function rememberUnit(
  state: CaptureState,
  unit: ProposedUnit,
  deps: CaptureDeps,
): Promise<StoredConcept> {
  // Only when the unit IS the whole selection do we reinforce the matched concept and reuse the
  // selection embedding; distinct units extracted from a paragraph become their own concepts.
  const isWhole = unit.text.trim() === state.selection.trim();
  return deps.brain.remember({
    encounterId: state.encounterId,
    text: unit.text,
    gloss: unit.gloss,
    type: unit.type,
    language: 'en',
    embedding: isWhole ? state.embedding : undefined,
    attachToConceptId: isWhole ? state.concept?.id : undefined,
  });
}
