import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { generateJSON } from '../llm.js';
import { GeminiError } from '../gemini.js';
import { CURATE_SCHEMA, curatePrompt, coerceConceptType } from '../prompts.js';
import { consumeAiQuota } from '../quota.js';

interface RawCurate {
  worthRemembering: boolean;
  reason: string;
  suggestedType: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

/** POST /v1/curate — LLM rubric for borderline "worth remembering?" decisions. */
export async function curateRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { text?: string; targetLanguage?: string; context?: string } }>(
    '/v1/curate',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { text, targetLanguage = 'en', context } = req.body ?? {};
      if (!text) return reply.code(400).send({ error: { code: 'bad_request', message: 'text required' } });
      if (!(await consumeAiQuota(req.user!.id, reply))) return;
      try {
        const { data: raw } = await generateJSON<RawCurate>(
          curatePrompt(text, targetLanguage, context),
          CURATE_SCHEMA,
        );
        return { ...raw, suggestedType: coerceConceptType(raw.suggestedType) };
      } catch (err) {
        const status = err instanceof GeminiError ? err.status : 502;
        req.log.error({ err }, 'curate failed');
        return reply.code(status >= 400 && status < 600 ? status : 502).send({
          error: {
            code: status === 429 ? 'rate_limited' : 'ai_error',
            message: err instanceof GeminiError ? err.message : 'curate failed',
            upstream: status,
          },
        });
      }
    },
  );
}
