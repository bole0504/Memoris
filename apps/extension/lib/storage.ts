/** Typed wrappers over extension storage.local (tokens NEVER go in page localStorage). */
import { ext } from './ext.js';

export interface Settings {
  /** User's native language (BCP-47), what we translate into. */
  targetLanguage: string;
  /** Per-domain "don't send to cloud" set (Phase 2 privacy). */
  privateDomains: string[];
  /** Push captures to the local Obsidian plugin bridge (Phase 4). */
  obsidianSync: boolean;
  /** Obsidian bridge URL (must match the plugin's port). */
  obsidianBridgeUrl: string;
}

export const DEFAULT_SETTINGS: Settings = {
  targetLanguage: 'vi',
  privateDomains: [],
  obsidianSync: true,
  obsidianBridgeUrl: 'http://127.0.0.1:8765',
};

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  email: string;
}

const KEYS = { settings: 'settings', auth: 'auth' } as const;

export async function getSettings(): Promise<Settings> {
  const r = await ext.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(r[KEYS.settings] as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await ext.storage.local.set({ [KEYS.settings]: next });
  return next;
}

export async function getAuth(): Promise<AuthTokens | undefined> {
  const r = await ext.storage.local.get(KEYS.auth);
  return r[KEYS.auth] as AuthTokens | undefined;
}

export async function setAuth(tokens: AuthTokens | undefined): Promise<void> {
  if (tokens) await ext.storage.local.set({ [KEYS.auth]: tokens });
  else await ext.storage.local.remove(KEYS.auth);
}
