import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { tenantMiddleware } from '@mauntic/worker-lib';
import type { TenantContext } from '@mauntic/domain-kernel';
import type { Env } from './infrastructure/database.js';
import { createDatabase } from './infrastructure/database.js';
import type { DrizzleDb } from './infrastructure/database.js';
import authRoutes from './interface/auth-routes.js';
import userRoutes from './interface/user-routes.js';
import orgRoutes from './interface/org-routes.js';

type AppEnv = {
  Bindings: Env;
  Variables: { tenant: TenantContext; db: DrizzleDb };
};

const app = new Hono<AppEnv>();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => origin, // Allow all origins in development; restrict in production
    credentials: true,
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'identity' });
});

// Mount auth routes (no tenant context needed - Better Auth handles its own auth)
app.route('/', authRoutes);

// Tenant context middleware for identity management routes
// These routes require X-Tenant-Context header from the gateway
app.use('/api/v1/identity/*', tenantMiddleware());
app.use('/api/v1/identity/*', async (c, next) => {
  const db = createDatabase(c.env);
  c.set('db', db);
  await next();
});

// Mount identity management routes
app.route('/', userRoutes);
app.route('/', orgRoutes);

export default app;
