import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { MemoryStore, type CaptureInput } from '@memoris/core';
import { IdbAdapter } from './idb-adapter.js';

function capture(selection: string): CaptureInput {
  return { selection, source: { id: 's', app: 'github.com', domain: 'github.com', url: 'https://x' } };
}

describe('IdbAdapter (browser brain v0) satisfies the store flow', () => {
  it('persists encounters/concepts and finds them by Tier-0 key', async () => {
    let n = 0;
    const brain = new MemoryStore({
      adapter: new IdbAdapter(`test-${Math.random().toString(36).slice(2)}`),
      genId: () => `id-${++n}`,
    });

    const r = await brain.lookup(capture('idempotent'));
    expect(r.tier).toBe('miss');
    const c = await brain.remember({ encounterId: r.encounter.id, text: 'idempotent', gloss: 'safe to repeat' });

    // Round-trips through IndexedDB.
    expect((await brain.getConcept(c.id))?.text).toBe('idempotent');

    const again = await brain.lookup(capture('  Idempotent. '));
    expect(again.tier).toBe(0);
    expect(again.concept?.encounterCount).toBe(2);

    const encs = await brain.conceptEncounters(c.id);
    expect(encs.length).toBe(2);
    expect(encs[0]!.source.domain).toBe('github.com');
  });
});
