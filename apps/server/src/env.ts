/** Tiny env loader — no extra deps; Node loads .env via --env-file in the dev/start scripts. */

function num(value: string | undefined, fallback: number): number {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const env = {
  port: num(process.env.PORT, 3000),
  host: process.env.HOST ?? '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  corsOrigins: (process.env.CORS_ORIGINS ?? '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
  geminiEmbedModel: process.env.GEMINI_EMBED_MODEL ?? 'gemini-embedding-001',

  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-change-me',
  jwtAccessTtlMin: num(process.env.JWT_ACCESS_TTL_MIN, 15),
  jwtRefreshTtlDays: num(process.env.JWT_REFRESH_TTL_DAYS, 30),

  freeDailyAiLookups: num(process.env.FREE_DAILY_AI_LOOKUPS, 50),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
} as const;
