import type { FastifyReply } from 'fastify';
import { prisma, getUsageToday, incrementUsage } from './db.js';
import { env } from './env.js';

/**
 * Enforce the free-plan daily AI cap at the gateway (docs/ROADMAP.md Phase 5). Pro is unlimited.
 * Returns true if the call may proceed; otherwise sends 429 and returns false.
 */
export async function consumeAiQuota(userId: string, reply: FastifyReply): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    await reply.code(401).send({ error: { code: 'unauthenticated', message: 'unknown user' } });
    return false;
  }
  if (user.plan !== 'pro') {
    const used = await getUsageToday(userId);
    if (used >= env.freeDailyAiLookups) {
      await reply.code(429).send({
        error: {
          code: 'quota_exceeded',
          message: `free plan daily AI limit reached (${env.freeDailyAiLookups}). Upgrade to Pro for unlimited.`,
        },
      });
      return false;
    }
  }
  await incrementUsage(userId);
  return true;
}
