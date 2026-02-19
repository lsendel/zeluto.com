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
import { validateSessionFromHeaders } from './application/session-service.js';
import identityDispatchRoutes from './interface/dispatch-routes.js';

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

app.post('/__dispatch/identity/session/validate', async (c) => {
  const payload = await c.req
    .json<{ headers?: Array<[string, string]> }>()
    .catch(() => null);

  let entries: Array<[string, string]> = [];
  if (Array.isArray(payload?.headers)) {
    entries = payload.headers as Array<[string, string]>;
  }

  const headerBag = new Headers();
  let applied = false;

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      continue;
    }
    const [key, value] = entry;
    if (typeof key === 'string' && typeof value === 'string') {
      headerBag.append(key, value);
      applied = true;
    }
  }

  if (!applied) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'headers are required' },
      400,
    );
  }

  const result = await validateSessionFromHeaders(c.env, headerBag);
  return c.json(result.body, result.status);
});

app.route('/__dispatch/identity', identityDispatchRoutes);

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
