import { MemoryStore } from '@memoris/core';
import { IdbAdapter } from './idb-adapter.js';

let singleton: MemoryStore | undefined;

/** The local brain, backed by IndexedDB. One instance per extension context. */
export function getBrain(): MemoryStore {
  if (!singleton) singleton = new MemoryStore({ adapter: new IdbAdapter() });
  return singleton;
}
