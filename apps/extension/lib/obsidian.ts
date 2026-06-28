import type { MemoryStore } from '@memoris/core';
import { getSettings } from './storage.js';

/**
 * Push the whole brain to the local Obsidian plugin bridge so concept notes (and their wikilinks →
 * the graph) stay in sync. Runs in the background service worker (extension origin), so reaching
 * http://127.0.0.1 is allowed and not blocked as mixed content. Best-effort.
 */
export async function syncToObsidian(brain: MemoryStore): Promise<boolean> {
  const s = await getSettings();
  if (!s.obsidianSync) return false;
  const data = await brain.export();
  const res = await fetch(`${s.obsidianBridgeUrl}/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.ok;
}
