import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { HealthResponse } from '@memoris/shared';
import { env } from './env.js';
import { prisma } from './db.js';
import { authRoutes } from './routes/auth.js';
import { analyzeRoutes } from './routes/analyze.js';
import { embedRoutes } from './routes/embed.js';
import { curateRoutes } from './routes/curate.js';
import { meRoutes } from './routes/me.js';

export const SERVER_VERSION = '0.1.0';

/**
 * Build the Fastify app (no listen). Separated from start so tests can inject it.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  await app.register(cors, {
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
  });

  // Per-IP abuse protection (per-user AI quota is enforced separately in quota.ts).
  await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  // Gateway health — Phase 0 exit criterion.
  app.get('/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      service: 'memoris-server',
      version: SERVER_VERSION,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
  });

  await app.register(authRoutes);
  await app.register(analyzeRoutes);
  await app.register(embedRoutes);
  await app.register(curateRoutes);
  await app.register(meRoutes);

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
