import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type Stripe from 'stripe';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase } from '@mauntic/worker-lib';
import { SubscriptionManager } from '@mauntic/billing-domain';
import { createStripeClient } from './infrastructure/stripe.js';
import { billingRoutes } from './interface/billing-routes.js';
import { webhookRoutes } from './interface/webhook-routes.js';

export interface Env {
  Bindings: {
    DATABASE_URL: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    APP_DOMAIN: string;
  };
  Variables: {
    tenant: TenantContext;
    db: NeonHttpDatabase<any>;
    stripe: Stripe;
  };
}

export function createApp() {
  const app = new Hono<Env>();

  // Middleware
  app.use('*', logger());
  app.use('*', cors());

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', service: 'billing' }));

  app.post('/__dispatch/billing/subscription/get', async (c) => {
    const payload = await c.req
      .json<{ organizationId?: string }>()
      .catch(() => null);
    if (!payload?.organizationId) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'organizationId is required' },
        400,
      );
    }

    try {
      const db = createDatabase(c.env.DATABASE_URL);
      const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
      const manager = new SubscriptionManager(db as any, stripe);
      const subscription = await manager.getSubscription(payload.organizationId);
      if (!subscription) {
        return c.json({ code: 'NOT_FOUND', message: 'No subscription found' }, 404);
      }
      return c.json(subscription);
    } catch (error) {
      console.error('Billing dispatch subscription query failed:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to fetch subscription' },
        500,
      );
    }
  });

  // Database and Stripe middleware for all API routes
  app.use('/api/*', async (c, next) => {
    const db = createDatabase(c.env.DATABASE_URL);
    const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
    c.set('db', db as any);
    c.set('stripe', stripe);
    await next();
  });

  // Tenant context required for all billing API routes (except webhooks)
  app.use('/api/v1/billing/plans/*', tenantMiddleware());
  app.use('/api/v1/billing/plans', tenantMiddleware());
  app.use('/api/v1/billing/subscription/*', tenantMiddleware());
  app.use('/api/v1/billing/subscription', tenantMiddleware());
  app.use('/api/v1/billing/usage/*', tenantMiddleware());
  app.use('/api/v1/billing/usage', tenantMiddleware());
  app.use('/api/v1/billing/invoices/*', tenantMiddleware());
  app.use('/api/v1/billing/invoices', tenantMiddleware());
  app.use('/api/v1/billing/portal', tenantMiddleware());

  // Mount routes - routes define their own full paths
  app.route('/', billingRoutes);
  app.route('/', webhookRoutes);

  return app;
}
