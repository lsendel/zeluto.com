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
import { connectionRoutes } from './interface/connection-routes.js';
import { oauthAppRoutes } from './interface/oauth-app-routes.js';
import { oauthFlowRoutes } from './interface/oauth-flow-routes.js';
import { syncRoutes } from './interface/sync-routes.js';
import { webhookRoutes } from './interface/webhook-routes.js';

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
app.get('/health', (c) => c.json({ status: 'ok', service: 'integrations' }));

// Database middleware for all API routes
app.use('/api/*', async (c, next) => {
  const db = createDatabase(c.env.DATABASE_URL);
  c.set('db', db as any);
  await next();
});

// Tenant context middleware — skip public OAuth and marketplace endpoints
const PUBLIC_PATHS = [
  '/api/v1/integrations/oauth/token',
  '/api/v1/integrations/marketplace',
];
app.use('/api/v1/integrations/*', async (c, next) => {
  if (PUBLIC_PATHS.some((p) => c.req.path === p)) {
    return next();
  }
  return tenantMiddleware()(c, next);
});

// Mount API routes
app.route('/', connectionRoutes);
app.route('/', oauthAppRoutes);
app.route('/', oauthFlowRoutes);
app.route('/', syncRoutes);
app.route('/', webhookRoutes);

export default app;
