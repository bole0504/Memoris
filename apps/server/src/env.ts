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

  // LLM provider for chat/translate. If OPENROUTER_API_KEY is set, chat routes through OpenRouter
  // (one API, many models, built-in fallback); otherwise it falls back to Gemini directly.
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? '',
  // OpenRouter model ids, tried in order for fallback. See https://openrouter.ai/models
  llmModels: (process.env.LLM_MODELS ?? 'openai/gpt-4o-mini')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite',
  geminiEmbedModel: process.env.GEMINI_EMBED_MODEL ?? 'gemini-embedding-001',
  // Tried in order when the primary model returns 429/503 (transient). Different models rarely
  // overload at once, so this makes a lookup almost always succeed.
  geminiFallbackModels: (process.env.GEMINI_FALLBACK_MODELS ?? 'gemini-2.0-flash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-change-me',
  jwtAccessTtlMin: num(process.env.JWT_ACCESS_TTL_MIN, 15),
  jwtRefreshTtlDays: num(process.env.JWT_REFRESH_TTL_DAYS, 30),

  freeDailyAiLookups: num(process.env.FREE_DAILY_AI_LOOKUPS, 50),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',

  // When set (comma-separated), only these emails may use the dev login. Protects a publicly
  // exposed gateway from strangers burning your Gemini quota. Empty = allow any (local dev).
  devLoginAllowedEmails: (process.env.DEV_LOGIN_ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
} as const;
