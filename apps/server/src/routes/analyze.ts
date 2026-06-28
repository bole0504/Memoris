import type { FastifyInstance } from 'fastify';
import type { AnalyzeRequest, AnalyzeResponse } from '@memoris/shared';
import { requireAuth } from '../auth.js';
import { generateJSON, GeminiError } from '../gemini.js';
import { ANALYZE_SCHEMA, analyzePrompt, coerceConceptType } from '../prompts.js';
import { consumeAiQuota } from '../quota.js';

interface RawAnalyze {
  translation: string;
  gloss: string;
  proposedUnits: { text: string; type: string; gloss: string }[];
}

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
      if (!(await consumeAiQuota(req.user!.id, reply))) return;

      const t0 = Date.now();
      try {
        const { data: raw, meta } = await generateJSON<RawAnalyze>(
          analyzePrompt(text, targetLanguage, context),
          ANALYZE_SCHEMA,
        );
        return {
          translation: raw.translation,
          gloss: raw.gloss,
          proposedUnits: (raw.proposedUnits ?? []).map((u) => ({
            text: u.text,
            type: coerceConceptType(u.type),
            gloss: u.gloss,
          })),
          timings: { aiMs: meta.aiMs, totalMs: Date.now() - t0, attempts: meta.attempts },
        };
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
