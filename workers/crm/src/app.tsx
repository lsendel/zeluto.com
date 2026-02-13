import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { contactRoutes } from './interface/contact-routes.js';
import { companyRoutes } from './interface/company-routes.js';
import { viewRoutes } from './interface/view-routes.js';

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
app.get('/health', (c) => c.json({ status: 'ok', service: 'crm' }));

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

// Tenant context middleware for CRM API and view routes
app.use('/api/v1/crm/*', tenantMiddleware());
app.use('/app/crm/*', tenantMiddleware());

// Mount API routes
app.route('/', contactRoutes);
app.route('/', companyRoutes);

// Mount HTMX view routes (HTML fragments)
app.route('/', viewRoutes);

export default app;
