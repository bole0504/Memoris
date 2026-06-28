import { SignJWT, jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from './env.js';

const secret = new TextEncoder().encode(env.jwtSecret);

export interface AuthUser {
  id: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export async function signAccessToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${env.jwtAccessTtlMin}m`)
    .sign(secret);
}

export async function signRefreshToken(user: AuthUser): Promise<string> {
  return new SignJWT({ email: user.email, typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${env.jwtRefreshTtlDays}d`)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, secret);
  if (!payload.sub || typeof payload.email !== 'string') throw new Error('bad token');
  return { id: payload.sub, email: payload.email };
}

/**
 * Fastify preHandler — requires a valid Bearer token. JWT authenticates the *user*, not the app,
 * which is sufficient for the MVP (docs/ARCHITECTURE.md §7).
 */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
  if (!token) {
    await reply.code(401).send({ error: { code: 'unauthenticated', message: 'missing bearer token' } });
    return;
  }
  try {
    req.user = await verifyToken(token);
  } catch {
    await reply.code(401).send({ error: { code: 'unauthenticated', message: 'invalid token' } });
  }
}
