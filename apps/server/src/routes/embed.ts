import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { embed, GeminiError } from '../gemini.js';
import { consumeAiQuota } from '../quota.js';

/** POST /v1/embed { text } → { embedding } for Tier-1 semantic search (docs/ARCHITECTURE.md §2). */
export async function embedRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { text?: string } }>(
    '/v1/embed',
    { preHandler: requireAuth },
    async (req, reply) => {
      const text = req.body?.text;
      if (!text) return reply.code(400).send({ error: { code: 'bad_request', message: 'text required' } });
      if (!(await consumeAiQuota(req.user!.id, reply))) return;
      const t0 = Date.now();
      try {
        const { embedding, meta } = await embed(text);
        return { embedding, timings: { aiMs: meta.aiMs, totalMs: Date.now() - t0, attempts: meta.attempts } };
      } catch (err) {
        const status = err instanceof GeminiError ? err.status : 502;
        req.log.error({ err }, 'embed failed');
        return reply.code(status >= 400 && status < 600 ? status : 502).send({
          error: {
            code: status === 429 ? 'rate_limited' : 'ai_error',
            message: err instanceof GeminiError ? err.message : 'embed failed',
            upstream: status,
          },
        });
      }
    },
  );
}
