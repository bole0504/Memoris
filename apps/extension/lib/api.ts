import type { AnalyzeResponse } from '@memoris/shared';
import { getAuth, setAuth } from './storage.js';
import { GATEWAY_URL } from './config.js';

/** Gateway client. The extension ALWAYS talks to our gateway, never to an LLM directly. */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function base(): Promise<string> {
  return GATEWAY_URL;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean; retry?: boolean; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true, signal } = opts;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (auth) {
    const tokens = await getAuth();
    if (!tokens) throw new ApiError('not signed in', 401);
    headers.authorization = `Bearer ${tokens.accessToken}`;
  }
  const res = await fetch(`${await base()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  // Try a one-shot refresh on 401.
  if (res.status === 401 && auth && retry) {
    if (await tryRefresh()) return request<T>(path, { ...opts, retry: false });
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(msg, res.status);
  }
  return json as T;
}

async function tryRefresh(): Promise<boolean> {
  const tokens = await getAuth();
  if (!tokens) return false;
  try {
    const r = await request<{ accessToken: string }>('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken: tokens.refreshToken },
      auth: false,
      retry: false,
    });
    await setAuth({ ...tokens, accessToken: r.accessToken });
    return true;
  } catch {
    return false;
  }
}

export async function login(email: string, name?: string): Promise<void> {
  const r = await request<{ accessToken: string; refreshToken: string; user: { email: string } }>(
    '/v1/auth/dev',
    { method: 'POST', body: { email, name }, auth: false },
  );
  await setAuth({ accessToken: r.accessToken, refreshToken: r.refreshToken, email: r.user.email });
}

export async function analyze(
  text: string,
  targetLanguage: string,
  context?: string,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>('/v1/analyze', {
    method: 'POST',
    body: { text, targetLanguage, context },
    signal,
  });
}

export async function embed(text: string, signal?: AbortSignal): Promise<number[]> {
  const r = await request<{ embedding: number[] }>('/v1/embed', { method: 'POST', body: { text }, signal });
  return r.embedding;
}

export interface CurateResponse {
  worthRemembering: boolean;
  reason: string;
  suggestedType: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export async function curate(text: string, targetLanguage: string, context?: string): Promise<CurateResponse> {
  return request<CurateResponse>('/v1/curate', { method: 'POST', body: { text, targetLanguage, context } });
}

export interface MeResponse {
  email: string;
  plan: string;
  usageToday: number;
  dailyLimit: number | null;
}

export async function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/v1/me');
}

export async function pushStats(stats: {
  concepts: number;
  encounters: number;
  streakDays: number;
  topConcepts: { text: string; encounterCount: number }[];
}): Promise<void> {
  await request('/v1/me/stats', { method: 'POST', body: stats });
}
