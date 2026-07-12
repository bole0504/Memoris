import type { FastifyInstance } from 'fastify';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { signAccessToken, signRefreshToken, verifyToken } from '../auth.js';
import { upsertUser, prisma } from '../db.js';
import { env } from '../env.js';

// Google's public keys for verifying ID tokens (cached by jose).
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/**
 * Auth routes. MVP uses a dev email login (fully self-verifiable, no external setup). Google OAuth
 * (docs/ROADMAP.md Phase 1) plugs in here behind the same token issuance once a Google client id
 * is configured.
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /v1/auth/dev { email, name? } → tokens. Disabled if a Google client id is configured.
  app.post<{ Body: { email?: string; name?: string } }>('/v1/auth/dev', async (req, reply) => {
    if (env.googleClientId) {
      return reply.code(403).send({ error: { code: 'disabled', message: 'use Google sign-in' } });
    }
    const email = req.body?.email?.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return reply.code(400).send({ error: { code: 'bad_request', message: 'valid email required' } });
    }
    if (env.devLoginAllowedEmails.length && !env.devLoginAllowedEmails.includes(email)) {
      return reply.code(403).send({ error: { code: 'forbidden', message: 'email not allowed' } });
    }
    const user = await upsertUser(email, req.body?.name);
    const authUser = { id: user.id, email: user.email };
    return {
      user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      accessToken: await signAccessToken(authUser),
      refreshToken: await signRefreshToken(authUser),
    };
  });

  // POST /v1/auth/google { idToken } → verify Google ID token → our tokens.
  app.post<{ Body: { idToken?: string } }>('/v1/auth/google', async (req, reply) => {
    if (!env.googleClientId) {
      return reply.code(501).send({ error: { code: 'not_configured', message: 'Google sign-in not configured' } });
    }
    const idToken = req.body?.idToken;
    if (!idToken) return reply.code(400).send({ error: { code: 'bad_request', message: 'idToken required' } });
    try {
      const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: env.googleClientId,
      });
      const email = String(payload.email ?? '').trim().toLowerCase();
      if (!email || payload.email_verified === false) throw new Error('email not verified');
      const user = await upsertUser(email, typeof payload.name === 'string' ? payload.name : undefined);
      const authUser = { id: user.id, email: user.email };
      return {
        user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
        accessToken: await signAccessToken(authUser),
        refreshToken: await signRefreshToken(authUser),
      };
    } catch (err) {
      req.log.warn({ err }, 'google auth failed');
      return reply.code(401).send({ error: { code: 'unauthenticated', message: 'invalid Google token' } });
    }
  });

  // POST /v1/auth/refresh { refreshToken } → new access token.
  app.post<{ Body: { refreshToken?: string } }>('/v1/auth/refresh', async (req, reply) => {
    const token = req.body?.refreshToken;
    if (!token) return reply.code(400).send({ error: { code: 'bad_request', message: 'refreshToken required' } });
    try {
      const u = await verifyToken(token);
      const exists = await prisma.user.findUnique({ where: { id: u.id } });
      if (!exists) throw new Error('no user');
      return { accessToken: await signAccessToken(u) };
    } catch {
      return reply.code(401).send({ error: { code: 'unauthenticated', message: 'invalid refresh token' } });
    }
  });
}
