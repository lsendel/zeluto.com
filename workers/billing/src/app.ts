import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type Stripe from 'stripe';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase } from '@mauntic/worker-lib';
import { createStripeClient } from './infrastructure/stripe.js';
import { billingRoutes } from './interface/billing-routes.js';
import { webhookRoutes } from './interface/webhook-routes.js';

export interface Env {
  Bindings: {
    HYPERDRIVE: Hyperdrive;
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

  // Database and Stripe middleware for all API routes
  app.use('/api/*', async (c, next) => {
    const db = createDatabase(c.env.HYPERDRIVE);
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
