import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { journeyRoutes } from './interface/journey-routes.js';
import { versionRoutes } from './interface/version-routes.js';
import { stepRoutes } from './interface/step-routes.js';
import { triggerRoutes } from './interface/trigger-routes.js';
import { executionRoutes } from './interface/execution-routes.js';
import { viewRoutes } from './interface/view-routes.js';
import { handleJourneyQueue } from './events/index.js';

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
app.get('/health', (c) => c.json({ status: 'ok', service: 'journey' }));

// Database middleware for API and view routes
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

// Tenant context middleware for journey API and view routes
app.use('/api/v1/journey/*', tenantMiddleware());
app.use('/app/journey/*', tenantMiddleware());

// Mount API routes
app.route('/', journeyRoutes);
app.route('/', versionRoutes);
app.route('/', stepRoutes);
app.route('/', triggerRoutes);
app.route('/', executionRoutes);

// Mount HTMX view routes (HTML fragments)
app.route('/', viewRoutes);

export default app;

// Queue consumer export for Cloudflare Workers
export const queue = handleJourneyQueue;
