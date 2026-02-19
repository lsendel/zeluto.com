import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { enrichmentRoutes } from './interface/enrichment-routes.js';
import { providerRoutes } from './interface/provider-routes.js';
import { healthRoutes } from './interface/health-routes.js';
import { waterfallRoutes } from './interface/waterfall-routes.js';

export type Env = {
  Bindings: {
    DATABASE_URL: string;
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
app.get('/health', (c) => c.json({ status: 'ok', service: 'lead-intelligence' }));

// Database middleware
app.use('/api/*', async (c, next) => {
  const db = createDatabase(c.env.DATABASE_URL);
  c.set('db', db as any);
  await next();
});
app.use('/app/*', async (c, next) => {
  const db = createDatabase(c.env.DATABASE_URL);
  c.set('db', db as any);
  await next();
});

// Tenant context middleware
app.use('/api/v1/lead-intelligence/*', tenantMiddleware());
app.use('/app/lead-intelligence/*', tenantMiddleware());

// Mount API routes
app.route('/', enrichmentRoutes);
app.route('/', providerRoutes);
app.route('/', healthRoutes);
app.route('/', waterfallRoutes);

export default app;
