import type { MemoryStore, BrainExport } from '@memoris/core';
import { ext } from './ext.js';

/**
 * Nấc 0 durability safety-net: keep a JSON snapshot of the brain in storage.local (separate from
 * IndexedDB) and auto-restore it if IndexedDB comes up empty (e.g. after a partial clear/corruption).
 * NOTE: same-origin storage — a full "clear browsing data" still wipes both. The real fix is the
 * companion app with a file-based DB (Nấc 1).
 */
const BACKUP_KEY = 'memoris:brain-backup';

export async function backupBrain(brain: MemoryStore): Promise<void> {
  const data = await brain.export();
  await ext.storage.local.set({ [BACKUP_KEY]: data });
}

/** If the brain is empty but a backup exists, restore it. Returns true if restored. */
export async function restoreIfEmpty(brain: MemoryStore): Promise<boolean> {
  const concepts = await brain.listConcepts();
  if (concepts.length > 0) return false;
  const r = await ext.storage.local.get(BACKUP_KEY);
  const data = r[BACKUP_KEY] as BrainExport | undefined;
  if (!data || !data.concepts?.length) return false;
  await brain.import(data);
  console.info(`[Memoris] restored brain from backup: ${data.concepts.length} concepts`);
  return true;
}
