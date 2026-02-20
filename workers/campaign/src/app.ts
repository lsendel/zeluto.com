import type { TenantContext } from '@mauntic/domain-kernel';
import {
  createDatabase,
  errorHandler,
  tenantMiddleware,
} from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { abTestRoutes } from './interface/ab-test-routes.js';
import { campaignRoutes } from './interface/campaign-routes.js';
import { pointRoutes } from './interface/point-routes.js';

export type Env = {
  Bindings: {
    DATABASE_URL: string;
    KV: KVNamespace;
    EVENTS: Queue;
    SERVICE_TENANT_USER_ID?: string;
    SERVICE_TENANT_USER_ROLE?: string;
    SERVICE_TENANT_PLAN?: string;
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
  const db = createDatabase(c.env.DATABASE_URL);
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
