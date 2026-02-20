import { Hono } from 'hono';
import type { Env } from '../index.js';
import { forwardToService } from '../lib/forward.js';

export function createBillingRoutes() {
  const app = new Hono<Env>();

  // Stripe webhook (public, no tenant context)
  app.post('/webhooks/stripe', async (c) => {
    return forwardToService(c, c.env.BILLING, { skipTenant: true });
  });

  // All other billing routes
  app.all('/*', async (c) => {
    return forwardToService(c, c.env.BILLING);
  });

  return app;
}
