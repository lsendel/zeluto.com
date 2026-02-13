import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { templateRoutes } from './interface/template-routes.js';
import { formRoutes } from './interface/form-routes.js';
import { pageRoutes } from './interface/page-routes.js';
import { assetRoutes } from './interface/asset-routes.js';
import { viewRoutes } from './interface/view-routes.js';

export type Env = {
  Bindings: {
    DATABASE_URL: string;
    KV: KVNamespace;
    EVENTS: Queue;
    ASSETS: R2Bucket;
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
app.get('/health', (c) => c.json({ status: 'ok', service: 'content' }));

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
app.use('/p/*', async (c, next) => {
  const db = createDatabase(c.env.DATABASE_URL);
  c.set('db', db as any);
  await next();
});

// Tenant context middleware for Content API and view routes
app.use('/api/v1/content/*', tenantMiddleware());
app.use('/app/content/*', tenantMiddleware());

// Mount API routes
app.route('/', templateRoutes);
app.route('/', formRoutes);
app.route('/', pageRoutes);
app.route('/', assetRoutes);

// Mount HTMX view routes (HTML fragments)
app.route('/', viewRoutes);

export default app;
