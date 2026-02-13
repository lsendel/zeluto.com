import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { connectionRoutes } from './interface/connection-routes.js';
import { syncRoutes } from './interface/sync-routes.js';
import { webhookRoutes } from './interface/webhook-routes.js';

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
app.get('/health', (c) => c.json({ status: 'ok', service: 'integrations' }));

// Database middleware for API routes
app.use('/api/*', async (c, next) => {
  const db = createDatabase(c.env.HYPERDRIVE);
  c.set('db', db as any);
  await next();
});

// Tenant context middleware for integrations API
app.use('/api/v1/integrations/*', tenantMiddleware());

// Mount API routes
app.route('/', connectionRoutes);
app.route('/', syncRoutes);
app.route('/', webhookRoutes);

export default app;
