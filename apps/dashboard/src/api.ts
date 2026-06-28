/**
 * Dashboard gateway client. Served same-origin as the gateway in prod (nginx proxies /v1, /health);
 * in dev, Vite proxies them to :3000. Token lives in localStorage (web app context).
 */

const TOKEN_KEY = 'memoris.dash.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string | null): void {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.auth !== false) {
    const t = getToken();
    if (t) headers.authorization = `Bearer ${t}`;
  }
  const r = await fetch(path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await r.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!r.ok) throw new Error(json?.error?.message ?? `HTTP ${r.status}`);
  return json as T;
}

export async function login(email: string): Promise<void> {
  const r = await req<{ accessToken: string }>('/v1/auth/dev', {
    method: 'POST',
    body: { email },
    auth: false,
  });
  setToken(r.accessToken);
}

export interface Me {
  email: string;
  plan: string;
  usageToday: number;
  dailyLimit: number | null;
}
export interface Stats {
  concepts: number;
  encounters: number;
  streakDays: number;
  topConcepts: { text: string; encounterCount: number }[];
  updatedAt: string | null;
}

export const getMe = () => req<Me>('/v1/me');
export const getStats = () => req<Stats>('/v1/me/stats');
export const setPlan = (plan: 'free' | 'pro') =>
  req<{ plan: string }>('/v1/billing/dev-set-plan', { method: 'POST', body: { plan } });
