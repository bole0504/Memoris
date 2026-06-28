import { env } from './env.js';

/**
 * Minimal Gemini REST client (no SDK). The API key lives only here on the gateway
 * (docs/ARCHITECTURE.md §3). Every call is timed + logged so latency and rate-limit retries are
 * visible in `pm2 logs memoris-server`.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

/** Latency/▶retry metadata for one logical call. */
export interface CallMeta {
  aiMs: number;
  attempts: number;
  status: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseRetryDelay(body: string): number | undefined {
  const m = body.match(/retry in ([\d.]+)s/i) ?? body.match(/"retryDelay":\s*"([\d.]+)s"/i);
  return m ? Number(m[1]) : undefined;
}

interface PostOpts {
  signal?: AbortSignal;
  /** Max attempts (interactive paths stay low so they fail fast instead of hanging). */
  attempts?: number;
  /** Cap on a single backoff wait, seconds. */
  capS?: number;
}

/** POST with bounded retry on transient 429/503. Returns the response + attempt count. */
async function postWithRetry(
  url: string,
  body: unknown,
  { signal, attempts = 2, capS = 6 }: PostOpts,
): Promise<{ res: Response; attempts: number }> {
  for (let i = 1; i <= attempts; i++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok || (res.status !== 429 && res.status !== 503) || i === attempts) {
      return { res, attempts: i };
    }
    const text = await res.clone().text().catch(() => '');
    const waitS = Math.min(parseRetryDelay(text) ?? 1.5 * i, capS);
    await sleep(waitS * 1000);
  }
  throw new GeminiError('unreachable', 500);
}

interface GenerateOptions extends PostOpts {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: unknown;
}

export async function generate(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<{ text: string; meta: CallMeta }> {
  if (!env.geminiApiKey) throw new GeminiError('GEMINI_API_KEY is not set', 500);
  const model = opts.model ?? env.geminiModel;
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.2,
    maxOutputTokens: opts.maxOutputTokens ?? 1024,
  };
  if (opts.responseSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = opts.responseSchema;
  }

  const t0 = Date.now();
  const { res, attempts } = await postWithRetry(
    `${BASE}/models/${model}:generateContent?key=${env.geminiApiKey}`,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig },
    opts,
  );
  const aiMs = Date.now() - t0;
  console.info(`[gemini] op=generate model=${model} ms=${aiMs} attempts=${attempts} status=${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    throw new GeminiError(`Gemini ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError('Gemini returned no text', 502);
  return { text, meta: { aiMs, attempts, status: res.status } };
}

export async function generateJSON<T>(
  prompt: string,
  schema: unknown,
  opts: GenerateOptions = {},
): Promise<{ data: T; meta: CallMeta }> {
  const { text, meta } = await generate(prompt, { ...opts, responseSchema: schema });
  try {
    return { data: JSON.parse(text) as T, meta };
  } catch {
    throw new GeminiError(`Gemini returned non-JSON: ${text.slice(0, 200)}`, 502);
  }
}

export async function embed(
  text: string,
  opts: PostOpts & { model?: string } = {},
): Promise<{ embedding: number[]; meta: CallMeta }> {
  if (!env.geminiApiKey) throw new GeminiError('GEMINI_API_KEY is not set', 500);
  const model = opts.model ?? env.geminiEmbedModel;
  const t0 = Date.now();
  const { res, attempts } = await postWithRetry(
    `${BASE}/models/${model}:embedContent?key=${env.geminiApiKey}`,
    { model: `models/${model}`, content: { parts: [{ text }] } },
    opts,
  );
  const aiMs = Date.now() - t0;
  console.info(`[gemini] op=embed model=${model} ms=${aiMs} attempts=${attempts} status=${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    throw new GeminiError(`Gemini embed ${res.status}: ${body.slice(0, 200)}`, res.status);
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values || values.length === 0) throw new GeminiError('Gemini returned no embedding', 502);
  return { embedding: values, meta: { aiMs, attempts, status: res.status } };
}
