/**
 * API contracts shared between the extension/dashboard (clients) and the server (gateway).
 *
 * Phase 0 only needs /health. The analyze/auth contracts are stubbed here so the extension and
 * server agree on shapes from the start; they get wired up in Phase 1.
 */

import type { ConceptType } from './model.js';

/** GET /health */
export interface HealthResponse {
  status: 'ok';
  service: 'memoris-server';
  /** Server package version. */
  version: string;
  /** Server uptime in seconds. */
  uptime: number;
  /** Server clock (ISO-8601). */
  time: string;
}

/** POST /v1/analyze — request (Phase 1; defined now so clients can compile against it). */
export interface AnalyzeRequest {
  /** Selected text to analyze. */
  text: string;
  /** BCP-47 tag of the user's native language, e.g. "vi". */
  targetLanguage: string;
  /** Minimal surrounding context (optional). */
  context?: string;
  /** Source domain, e.g. "github.com" (for routing/telemetry, not stored raw). */
  sourceDomain?: string;
}

/** A worth-remembering unit the AI proposes from a selection/paragraph. */
export interface ProposedUnit {
  text: string;
  type: ConceptType;
  gloss: string;
}

/** POST /v1/analyze — response (Phase 1). */
export interface AnalyzeResponse {
  /** Tier-1 fast translation of the whole selection. */
  translation: string;
  /** One-line gloss for the primary selection. */
  gloss: string;
  /** Units the AI suggests saving as concepts (user decides). */
  proposedUnits: ProposedUnit[];
}

/** Shape of an error body returned by the gateway. */
export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}
