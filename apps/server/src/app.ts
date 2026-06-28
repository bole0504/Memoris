import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { HealthResponse } from '@memoris/shared';
import { env } from './env.js';

export const SERVER_VERSION = '0.0.0';

/**
 * Build the Fastify app (no listen). Separated from start so tests can inject it.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  await app.register(cors, {
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
  });

  // Gateway health — Phase 0 exit criterion: returns 200 from behind Cloudflare.
  app.get('/health', async (): Promise<HealthResponse> => {
    return {
      status: 'ok',
      service: 'memoris-server',
      version: SERVER_VERSION,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    };
  });

  return app;
}
