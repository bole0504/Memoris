import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStore, InMemoryAdapter, type CaptureInput } from '@memoris/core';
import type { AnalyzeResponse } from '@memoris/shared';
import { runCapture, rememberUnit, type CaptureDeps } from './capture-controller.js';

function makeDeps(brain: MemoryStore): CaptureDeps {
  const analyze = vi.fn(
    async (text: string): Promise<AnalyzeResponse> => ({
      translation: `VI(${text})`,
      gloss: 'a one-line gloss',
      proposedUnits: [{ text, type: 'term', gloss: 'unit gloss' }],
    }),
  );
  return { analyze, brain, targetLanguage: 'vi' };
}

function capture(selection: string): CaptureInput {
  return { selection, source: { id: 's', app: 'github.com', domain: 'github.com', url: 'https://x' } };
}

describe('capture controller (Phase 1 loop)', () => {
  let brain: MemoryStore;
  let deps: CaptureDeps;

  beforeEach(() => {
    let n = 0;
    brain = new MemoryStore({ adapter: new InMemoryAdapter(), genId: () => `id-${++n}` });
    deps = makeDeps(brain);
  });

  it('select → analyze → encounter logged → new verdict', async () => {
    const state = await runCapture(capture('idempotent'), deps);
    expect(state.analysis.translation).toBe('VI(idempotent)');
    expect(state.tier).toBe('miss');
    expect(state.verdict.status).toBe('new');
    expect(state.encounterId).toBeTruthy();
    expect(deps.analyze).toHaveBeenCalledOnce();
  });

  it('Remember saves the unit with its source context', async () => {
    const state = await runCapture(capture('idempotent'), deps);
    const c = await rememberUnit(state, state.analysis.proposedUnits[0]!, deps);
    expect(c.text).toBe('idempotent');
    const encs = await brain.conceptEncounters(c.id);
    expect(encs[0]!.source.domain).toBe('github.com');
    const stats = await brain.stats();
    expect(stats.concepts).toBe(1);
  });

  it('second capture of the same term reports "seen 2×"', async () => {
    const s1 = await runCapture(capture('idempotent'), deps);
    await rememberUnit(s1, s1.analysis.proposedUnits[0]!, deps);
    const s2 = await runCapture(capture('idempotent'), deps);
    expect(s2.tier).toBe(0);
    expect(s2.verdict.status).toBe('seen');
    expect(s2.verdict.seenCount).toBe(2);
  });
});
