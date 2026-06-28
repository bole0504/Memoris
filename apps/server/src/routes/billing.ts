import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../auth.js';
import { prisma } from '../db.js';

/**
 * Billing routes. MVP ships a dev upgrade/downgrade so the Free↔Pro quota path is testable
 * end-to-end. Stripe Checkout (docs/ROADMAP.md Phase 5) plugs in here: create a Checkout session,
 * and flip `plan` from the Stripe webhook instead of this dev endpoint.
 */
export async function billingRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { plan?: 'free' | 'pro' } }>(
    '/v1/billing/dev-set-plan',
    { preHandler: requireAuth },
    async (req, reply) => {
      const plan = req.body?.plan === 'pro' ? 'pro' : 'free';
      const user = await prisma.user.update({ where: { id: req.user!.id }, data: { plan } });
      return { plan: user.plan };
    },
  );

  // Placeholder for the real flow. Returns 501 until STRIPE_SECRET_KEY is wired.
  app.post('/v1/billing/checkout', { preHandler: requireAuth }, async (_req, reply) => {
    return reply.code(501).send({
      error: { code: 'not_implemented', message: 'Stripe Checkout not configured (Phase 5 follow-up)' },
    });
  });
}
