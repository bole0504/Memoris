import type { MemoryStore, CaptureInput, CurationVerdict, StoredConcept } from '@memoris/core';
import type { AnalyzeResponse, ProposedUnit } from '@memoris/shared';

/**
 * The Phase 1 capture loop, decoupled from React so it can be unit-tested in Node:
 *   select → analyze (translate + gloss + units) → log encounter → curation verdict.
 *
 * Embeddings are NOT computed here anymore (cost): they are generated once, at "Remember" time,
 * per saved concept (see background.ts). That powers relationships/graph in the Knowledge page.
 */
export interface CaptureDeps {
  analyze: (
    text: string,
    targetLanguage: string,
    context?: string,
    signal?: AbortSignal,
  ) => Promise<AnalyzeResponse>;
  brain: MemoryStore;
  targetLanguage: string;
}

export interface CaptureState {
  selection: string;
  encounterId: string;
  tier: 0 | 1 | 2 | 'miss';
  analysis: AnalyzeResponse;
  verdict: CurationVerdict;
  /** Existing concept if Tier-0 matched. */
  concept?: StoredConcept;
}

export async function runCapture(
  input: CaptureInput,
  deps: CaptureDeps,
  signal?: AbortSignal,
): Promise<CaptureState> {
  const analysis = await deps.analyze(input.selection, deps.targetLanguage, input.surroundingContext, signal);

  const lookup = await deps.brain.lookup(input);
  const verdict = await deps.brain.curate(input);

  return {
    selection: input.selection,
    encounterId: lookup.encounter.id,
    tier: lookup.tier,
    analysis,
    verdict,
    concept: lookup.concept,
  };
}

/** Save a proposed unit as a concept, attached to the capture's encounter (its source context). */
export async function rememberUnit(
  state: CaptureState,
  unit: ProposedUnit,
  deps: CaptureDeps,
): Promise<StoredConcept> {
  // Reinforce the matched concept only when the unit IS the whole selection; distinct units
  // extracted from a paragraph become their own concepts. Embedding is added afterwards.
  const isWhole = unit.text.trim() === state.selection.trim();
  return deps.brain.remember({
    encounterId: state.encounterId,
    text: unit.text,
    gloss: unit.gloss,
    type: unit.type,
    language: 'en',
    attachToConceptId: isWhole ? state.concept?.id : undefined,
  });
}
