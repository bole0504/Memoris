import { env } from './env.js';

/**
 * Minimal Gemini REST client (no SDK — keeps deps light and the surface obvious).
 * The API key lives only here on the gateway, never in the client (docs/ARCHITECTURE.md §3).
 *
 * Model routing (docs/ARCHITECTURE.md §3): translate/gloss uses the cheap fast model; the same
 * client can be pointed at a bigger model per task by passing `model`.
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

interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** A JSON schema → forces structured JSON output. */
  responseSchema?: unknown;
}

/** Low-level text generation. Returns the model's text part. */
export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string> {
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

  const res = await fetch(`${BASE}/models/${model}:generateContent?key=${env.geminiApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GeminiError(`Gemini ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError('Gemini returned no text', 502);
  return text;
}

/** Structured generation: parses the JSON the schema enforced. */
export async function generateJSON<T>(prompt: string, schema: unknown, opts: GenerateOptions = {}): Promise<T> {
  const text = await generate(prompt, { ...opts, responseSchema: schema });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError(`Gemini returned non-JSON: ${text.slice(0, 200)}`, 502);
  }
}

/** Embedding for a single text. Used by Tier-1 semantic search (Phase 2). */
export async function embed(text: string, model = env.geminiEmbedModel): Promise<number[]> {
  if (!env.geminiApiKey) throw new GeminiError('GEMINI_API_KEY is not set', 500);
  const res = await fetch(`${BASE}/models/${model}:embedContent?key=${env.geminiApiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new GeminiError(`Gemini embed ${res.status}: ${body.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values || values.length === 0) throw new GeminiError('Gemini returned no embedding', 502);
  return values;
}
