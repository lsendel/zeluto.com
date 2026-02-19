import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { dealRoutes } from './interface/deal-routes.js';
import { forecastRoutes } from './interface/forecast-routes.js';
import { routingRoutes } from './interface/routing-routes.js';
import { sdrRoutes } from './interface/sdr-routes.js';
import { researchRoutes } from './interface/research-routes.js';
import { agentRoutes } from './interface/agent-routes.js';
import { workflowRoutes } from './interface/workflow-routes.js';

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
app.get('/health', (c) => c.json({ status: 'ok', service: 'revops' }));

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
app.use('/api/v1/revops/*', tenantMiddleware());
app.use('/app/revops/*', tenantMiddleware());

// Mount API routes
app.route('/', dealRoutes);
app.route('/', forecastRoutes);
app.route('/', routingRoutes);
app.route('/', sdrRoutes);
app.route('/', researchRoutes);
app.route('/', agentRoutes);
app.route('/', workflowRoutes);

export default app;
