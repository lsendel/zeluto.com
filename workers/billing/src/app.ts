import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { billingRoutes } from './interface/billing-routes.js';
import { webhookRoutes } from './interface/webhook-routes.js';

export interface Env {
  DB: Hyperdrive;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  APP_DOMAIN: string;
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // Middleware
  app.use('*', logger());
  app.use('*', cors());

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', service: 'billing' }));

  // Routes
  app.route('/billing', billingRoutes);
  app.route('/webhooks', webhookRoutes);

  return app;
}
