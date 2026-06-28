/** Typed wrappers over extension storage.local (tokens NEVER go in page localStorage). */
import { browser } from 'wxt/browser';

export interface Settings {
  /** Gateway base URL. */
  apiBaseUrl: string;
  /** User's native language (BCP-47), what we translate into. */
  targetLanguage: string;
  /** Per-domain "don't send to cloud" set (Phase 2 privacy). */
  privateDomains: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  apiBaseUrl: 'http://localhost:3000',
  targetLanguage: 'vi',
  privateDomains: [],
};

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  email: string;
}

const KEYS = { settings: 'settings', auth: 'auth' } as const;

export async function getSettings(): Promise<Settings> {
  const r = await browser.storage.local.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(r[KEYS.settings] as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await browser.storage.local.set({ [KEYS.settings]: next });
  return next;
}

export async function getAuth(): Promise<AuthTokens | undefined> {
  const r = await browser.storage.local.get(KEYS.auth);
  return r[KEYS.auth] as AuthTokens | undefined;
}

export async function setAuth(tokens: AuthTokens | undefined): Promise<void> {
  if (tokens) await browser.storage.local.set({ [KEYS.auth]: tokens });
  else await browser.storage.local.remove(KEYS.auth);
}
