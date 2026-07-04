import { env } from './env.js';
import {
  GeminiError,
  generateJSON as geminiGenerateJSON,
  type CallMeta,
} from './gemini.js';

/**
 * LLM provider abstraction for chat/translate (docs/ARCHITECTURE.md §3 — model routing).
 *
 * If OPENROUTER_API_KEY is set, requests go to OpenRouter (one OpenAI-compatible API, many models,
 * fallback across `LLM_MODELS`). Otherwise they fall back to Gemini directly — so local dev / the
 * harness keep working on the free Gemini key, and switching to OpenRouter on the VPS is just an
 * env change, no code change.
 *
 * Embeddings are NOT routed here — they stay on Gemini (see gemini.ts `embed`).
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface LlmOptions {
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  attempts?: number;
}

/** Pull a JSON object out of a model reply that may wrap it in prose or ```json fences. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1]! : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start !== -1 && end !== -1 ? body.slice(start, end + 1) : body;
}

async function openRouterJSON<T>(
  prompt: string,
  schema: unknown,
  opts: LlmOptions,
): Promise<{ data: T; meta: CallMeta }> {
  const attemptsMax = opts.attempts ?? 3;
  // OpenRouter/OpenAI need the shape in-band for reliable json_object output across models.
  const augmented = `${prompt}\n\nReturn ONLY a JSON object (no markdown, no comments) matching this JSON schema:\n${JSON.stringify(
    schema,
  )}`;
  const requestBody = {
    model: env.llmModels[0],
    models: env.llmModels, // OpenRouter auto-falls-back through this list on error
    messages: [{ role: 'user', content: augmented }],
    response_format: { type: 'json_object' },
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxOutputTokens ?? 768,
  };

  const t0 = Date.now();
  let res: Response | undefined;
  let attempts = 0;
  for (let i = 1; i <= attemptsMax; i++) {
    attempts = i;
    res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.openRouterApiKey}`,
        'content-type': 'application/json',
        'HTTP-Referer': 'https://memoris.app',
        'X-Title': 'Memoris',
      },
      body: JSON.stringify(requestBody),
      signal: opts.signal,
    });
    if (res.ok || (res.status !== 429 && res.status !== 503) || i === attemptsMax) break;
    await sleep(Math.min(1.5 * i, 6) * 1000);
  }

  const aiMs = Date.now() - t0;
  if (!res || !res.ok) {
    const errText = res ? await res.text() : 'no response';
    console.info(`[llm] provider=openrouter status=${res?.status} attempts=${attempts}`);
    throw new GeminiError(`OpenRouter ${res?.status ?? 0}: ${errText.slice(0, 200)}`, res?.status ?? 502);
  }
  const data = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
  };
  console.info(
    `[llm] provider=openrouter model=${data.model ?? '?'} ms=${aiMs} attempts=${attempts} status=200`,
  );
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new GeminiError('OpenRouter returned no content', 502);
  try {
    return { data: JSON.parse(extractJson(text)) as T, meta: { aiMs, attempts, status: 200 } };
  } catch {
    throw new GeminiError(`OpenRouter returned non-JSON: ${text.slice(0, 200)}`, 502);
  }
}

/**
 * Structured generation, provider-agnostic. Routes to OpenRouter when configured, else Gemini.
 */
export async function generateJSON<T>(
  prompt: string,
  schema: unknown,
  opts: LlmOptions = {},
): Promise<{ data: T; meta: CallMeta }> {
  if (env.openRouterApiKey) return openRouterJSON<T>(prompt, schema, opts);
  return geminiGenerateJSON<T>(prompt, schema, opts);
}
