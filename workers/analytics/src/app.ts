import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { eventRoutes } from './interface/event-routes.js';
import { reportRoutes } from './interface/report-routes.js';
import { dashboardRoutes } from './interface/dashboard-routes.js';
import { analyticsDispatchRoutes } from './interface/dispatch-routes.js';

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
app.get('/health', (c) => c.json({ status: 'ok', service: 'analytics' }));

// Database middleware for API routes
app.use('/api/*', async (c, next) => {
  const db = createDatabase(c.env.DATABASE_URL);
  c.set('db', db as any);
  await next();
});

// Tenant context middleware for analytics API
app.use('/api/v1/analytics/*', tenantMiddleware());

// Mount API routes
app.route('/', eventRoutes);
app.route('/', reportRoutes);
app.route('/', dashboardRoutes);
app.route('/__dispatch/analytics', analyticsDispatchRoutes);

export default app;
