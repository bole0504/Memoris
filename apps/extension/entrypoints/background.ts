import { browser } from 'wxt/browser';
import { getBrain } from '../lib/brain.js';
import { analyze, embed, pushStats, ApiError } from '../lib/api.js';
import { getSettings } from '../lib/storage.js';
import { runCapture, rememberUnit, type CaptureDeps, type CaptureState } from '../lib/capture-controller.js';
import { syncToObsidian } from '../lib/obsidian.js';
import { MSG, type AnyRequest, type CaptureResult, type Reply } from '../lib/messages.js';

/**
 * The background service worker OWNS the brain. Content scripts run in the page's origin (separate
 * IndexedDB) and can't reach the http gateway from an https page (mixed content), so all network +
 * brain work happens here, behind a message API. This keeps ONE brain for the whole browser.
 */
export default defineBackground(() => {
  browser.runtime.onMessage.addListener((msg: AnyRequest, _sender, sendResponse) => {
    handle(msg)
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    return true; // keep the channel open for the async response
  });
});

async function deps(): Promise<CaptureDeps> {
  const settings = await getSettings();
  return { analyze, embed, brain: getBrain(), targetLanguage: settings.targetLanguage };
}

// In-flight captures, so a "click outside" can abort the upstream request.
const inFlight = new Map<string, AbortController>();

async function handle(msg: AnyRequest): Promise<Reply<unknown>> {
  switch (msg?.type) {
    case MSG.capture:
      return capture(msg.captureId, msg.selection, msg.context, msg.source);
    case MSG.cancel:
      inFlight.get(msg.captureId)?.abort();
      inFlight.delete(msg.captureId);
      return { ok: true, data: null };
    case MSG.remember:
      return remember(msg.encounterId, msg.unitText);
    case MSG.syncObsidian:
      return { ok: true, data: { ok: await syncToObsidian(getBrain()) } };
    default:
      return { ok: false, error: 'unknown message' };
  }
}

async function capture(
  captureId: string,
  selection: string,
  context: string | undefined,
  source: import('@memoris/shared').Source,
): Promise<Reply<CaptureResult>> {
  const controller = new AbortController();
  inFlight.set(captureId, controller);
  try {
    const state = await runCapture(
      { selection, surroundingContext: context, source },
      await deps(),
      controller.signal,
    );
    await stash(state);
    return {
      ok: true,
      data: {
        encounterId: state.encounterId,
        tier: state.tier,
        analysis: state.analysis,
        verdict: state.verdict,
        timings: state.analysis.timings,
      },
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return { ok: false, error: 'cancelled' };
    if (e instanceof ApiError && e.status === 401) return { ok: false, error: 'sign in', needAuth: true };
    return { ok: false, error: e instanceof Error ? e.message : 'capture failed' };
  } finally {
    inFlight.delete(captureId);
  }
}

async function remember(encounterId: string, unitText: string): Promise<Reply<{ conceptId: string }>> {
  const entry = await unstash(encounterId);
  if (!entry) return { ok: false, error: 'capture expired — select again' };
  const unit = entry.state.analysis.proposedUnits.find((u) => u.text === unitText);
  if (!unit) return { ok: false, error: 'unit not found' };

  const brain = getBrain();
  const concept = await rememberUnit(entry.state, unit, await deps());

  entry.savedConceptIds = [...new Set([...entry.savedConceptIds, concept.id])];
  await restash(encounterId, entry);
  if (entry.savedConceptIds.length >= 2) await brain.linkCoOccurrence(entry.savedConceptIds);

  // Best-effort: refresh dashboard stats and push to Obsidian.
  try {
    const s = await brain.stats();
    await pushStats({
      concepts: s.concepts,
      encounters: s.encounters,
      streakDays: 0,
      topConcepts: s.topConcepts.map((c) => ({ text: c.text, encounterCount: c.encounterCount })),
    });
  } catch {
    /* offline / not signed in */
  }
  try {
    await syncToObsidian(brain);
  } catch {
    /* Obsidian not running — fine */
  }

  return { ok: true, data: { conceptId: concept.id } };
}

// --- Capture state stash (survives SW restarts via storage.session) ---

interface StashEntry {
  state: CaptureState;
  savedConceptIds: string[];
}
const KEY = 'memoris:captures';
const MAX = 20;

async function readAll(): Promise<Record<string, StashEntry>> {
  const r = await browser.storage.session.get(KEY);
  return (r[KEY] as Record<string, StashEntry> | undefined) ?? {};
}

async function stash(state: CaptureState): Promise<void> {
  const all = await readAll();
  all[state.encounterId] = { state, savedConceptIds: [] };
  // Prune oldest beyond MAX (object insertion order is preserved).
  const keys = Object.keys(all);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX))) delete all[k];
  await browser.storage.session.set({ [KEY]: all });
}

async function unstash(encounterId: string): Promise<StashEntry | undefined> {
  return (await readAll())[encounterId];
}

async function restash(encounterId: string, entry: StashEntry): Promise<void> {
  const all = await readAll();
  all[encounterId] = entry;
  await browser.storage.session.set({ [KEY]: all });
}
