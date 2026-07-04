import type { FastifyInstance } from 'fastify';
import type { AnalyzeRequest, AnalyzeResponse } from '@memoris/shared';
import { requireAuth } from '../auth.js';
import { generateJSON, GeminiError } from '../gemini.js';
import { ANALYZE_SCHEMA, analyzePrompt, coerceConceptType } from '../prompts.js';
import { consumeAiQuota } from '../quota.js';
import { TtlCache } from '../cache.js';

interface RawAnalyze {
  translation: string;
  gloss: string;
  proposedUnits: { text: string; type: string; gloss: string }[];
}

// Tier-0 cache: identical (language + text) → instant, no AI call, no quota spent.
const analyzeCache = new TtlCache<Omit<AnalyzeResponse, 'timings' | 'cached'>>(1000, 6 * 60 * 60 * 1000);

/** POST /v1/analyze — the Tier-2 fast path: translation + gloss + worth-remembering units. */
export async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: AnalyzeRequest }>(
    '/v1/analyze',
    { preHandler: requireAuth },
    async (req, reply): Promise<AnalyzeResponse | void> => {
      const { text, targetLanguage, context } = req.body ?? {};
      if (!text || !targetLanguage) {
        return reply.code(400).send({ error: { code: 'bad_request', message: 'text and targetLanguage required' } });
      }

      const t0 = Date.now();
      // Tier-0 cache hit → instant, no AI call, no quota consumed.
      const cacheKey = `${targetLanguage}::${text.trim().toLowerCase()}`;
      const hit = analyzeCache.get(cacheKey);
      if (hit) {
        return { ...hit, cached: true, timings: { aiMs: 0, totalMs: Date.now() - t0, attempts: 0 } };
      }

      if (!(await consumeAiQuota(req.user!.id, reply))) return;

      try {
        const { data: raw, meta } = await generateJSON<RawAnalyze>(
          analyzePrompt(text, targetLanguage, context),
          ANALYZE_SCHEMA,
          { maxOutputTokens: 768 },
        );
        const result = {
          translation: raw.translation,
          gloss: raw.gloss,
          proposedUnits: (raw.proposedUnits ?? []).map((u) => ({
            text: u.text,
            type: coerceConceptType(u.type),
            gloss: u.gloss,
          })),
        };
        analyzeCache.set(cacheKey, result);
        return { ...result, cached: false, timings: { aiMs: meta.aiMs, totalMs: Date.now() - t0, attempts: meta.attempts } };
      } catch (err) {
        const status = err instanceof GeminiError ? err.status : 502;
        req.log.error({ err }, 'analyze failed');
        return reply.code(status >= 400 && status < 600 ? status : 502).send({
          error: {
            code: status === 429 ? 'rate_limited' : 'ai_error',
            message: err instanceof GeminiError ? err.message : 'analysis failed',
            upstream: status,
          },
        });
      }
    },
  );
}
