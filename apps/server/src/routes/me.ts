import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma, getUsageToday } from '../db.js';
import { env } from '../env.js';

interface StatsBody {
  concepts?: number;
  encounters?: number;
  streakDays?: number;
  topConcepts?: { text: string; encounterCount: number }[];
}

/** Account + stats routes. Stats are counts only — concept content stays local (privacy). */
export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/me', { preHandler: requireAuth }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return reply.code(404).send({ error: { code: 'not_found', message: 'user' } });
    const usageToday = await getUsageToday(user.id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      usageToday,
      dailyLimit: user.plan === 'pro' ? null : env.freeDailyAiLookups,
    };
  });

  app.get('/v1/me/stats', { preHandler: requireAuth }, async (req) => {
    const s = await prisma.stats.findUnique({ where: { userId: req.user!.id } });
    return {
      concepts: s?.concepts ?? 0,
      encounters: s?.encounters ?? 0,
      streakDays: s?.streakDays ?? 0,
      topConcepts: s ? (JSON.parse(s.topConcepts) as unknown[]) : [],
      updatedAt: s?.updatedAt ?? null,
    };
  });

  // The extension pushes a small counts-only snapshot so the dashboard can show growth.
  app.post<{ Body: StatsBody }>('/v1/me/stats', { preHandler: requireAuth }, async (req) => {
    const b = req.body ?? {};
    const top = JSON.stringify((b.topConcepts ?? []).slice(0, 10));
    const data = {
      concepts: b.concepts ?? 0,
      encounters: b.encounters ?? 0,
      streakDays: b.streakDays ?? 0,
      topConcepts: top,
    };
    const saved = await prisma.stats.upsert({
      where: { userId: req.user!.id },
      update: data,
      create: { userId: req.user!.id, ...data },
    });
    return { ok: true, updatedAt: saved.updatedAt };
  });
}
