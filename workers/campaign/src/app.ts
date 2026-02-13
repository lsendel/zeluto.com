import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { campaignRoutes } from './interface/campaign-routes.js';
import { abTestRoutes } from './interface/ab-test-routes.js';
import { pointRoutes } from './interface/point-routes.js';
import { handleCampaignQueue } from './events/index.js';

export type Env = {
  Bindings: {
    HYPERDRIVE: Hyperdrive;
    KV: KVNamespace;
    EVENTS: Queue;
  };
  Variables: {
    tenant: TenantContext;
    db: NeonHttpDatabase;
  };
};

const app = new Hono<Env>();

// Global middleware
app.use('*', logger());
app.use('*', cors());
app.use('*', errorHandler());

// Health check (no auth required)
app.get('/health', (c) => c.json({ status: 'ok', service: 'campaign' }));

// Database middleware for API routes
app.use('/api/*', async (c, next) => {
  const db = createDatabase(c.env.HYPERDRIVE);
  c.set('db', db as any);
  await next();
});

// Tenant context middleware for campaign API routes
app.use('/api/v1/campaign/*', tenantMiddleware());

// Mount route handlers
app.route('/', campaignRoutes);
app.route('/', abTestRoutes);
app.route('/', pointRoutes);

export default app;

// Queue consumer export for Cloudflare Workers
export const queue = handleCampaignQueue;
