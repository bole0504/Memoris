import type { AnalyzeResponse, Timings } from '@memoris/shared';
import type { CurationVerdict } from '@memoris/core';

/** Message protocol between the content script / popup and the background brain owner. */

export const MSG = {
  capture: 'memoris:capture',
  cancel: 'memoris:cancel',
  remember: 'memoris:remember',
  syncObsidian: 'memoris:sync-obsidian',
} as const;

export interface CaptureRequest {
  type: typeof MSG.capture;
  /** Client-generated id so an in-flight capture can be cancelled. */
  captureId: string;
  selection: string;
  context?: string;
  source: import('@memoris/shared').Source;
}

export interface CancelRequest {
  type: typeof MSG.cancel;
  captureId: string;
}

/** Lightweight capture result sent back to the popover (no heavy embedding). */
export interface CaptureResult {
  encounterId: string;
  tier: 0 | 1 | 2 | 'miss';
  analysis: AnalyzeResponse;
  verdict: CurationVerdict;
  timings?: Timings;
}

export interface RememberRequest {
  type: typeof MSG.remember;
  encounterId: string;
  unitText: string;
}

export interface SyncObsidianRequest {
  type: typeof MSG.syncObsidian;
}

export type AnyRequest = CaptureRequest | CancelRequest | RememberRequest | SyncObsidianRequest;

/** Discriminated response wrapper so callers can detect the need-auth / error states. */
export type Reply<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; needAuth?: boolean };
