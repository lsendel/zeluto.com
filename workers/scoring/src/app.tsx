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
import { alertRoutes } from './interface/alert-routes.js';
import { configRoutes } from './interface/config-routes.js';
import { dlqRoutes } from './interface/dlq-routes.js';
import { scoreRoutes } from './interface/score-routes.js';
import { signalRoutes } from './interface/signal-routes.js';
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
app.get('/health', (c) => c.json({ status: 'ok', service: 'scoring' }));

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
app.use('/api/v1/scoring/*', tenantMiddleware());
app.use('/app/scoring/*', tenantMiddleware());

// Mount API routes
app.route('/', scoreRoutes);
app.route('/', signalRoutes);
app.route('/', alertRoutes);
app.route('/', configRoutes);
app.route('/', dlqRoutes);
app.route('/', viewRoutes);

export default app;
