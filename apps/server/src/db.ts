import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** Day bucket "YYYY-MM-DD" in UTC. */
export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function upsertUser(email: string, name?: string) {
  return prisma.user.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name },
  });
}

/** How many Tier-2 (real AI) lookups the user has made today. */
export async function getUsageToday(userId: string): Promise<number> {
  const row = await prisma.usageDay.findUnique({
    where: { userId_day: { userId, day: dayKey() } },
  });
  return row?.lookups ?? 0;
}

/** Atomically record one AI lookup; returns the new count for today. */
export async function incrementUsage(userId: string): Promise<number> {
  const row = await prisma.usageDay.upsert({
    where: { userId_day: { userId, day: dayKey() } },
    update: { lookups: { increment: 1 } },
    create: { userId, day: dayKey(), lookups: 1 },
  });
  return row.lookups;
}
