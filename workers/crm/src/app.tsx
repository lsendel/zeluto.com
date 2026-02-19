import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { TenantContext } from '@mauntic/domain-kernel';
import { tenantMiddleware, createDatabase, errorHandler } from '@mauntic/worker-lib';
import { contactRoutes } from './interface/contact-routes.js';
import { companyRoutes } from './interface/company-routes.js';
import { viewRoutes } from './interface/view-routes.js';
import { segmentRoutes } from './interface/segment-routes.js';
import { querySegmentContacts, SegmentNotFoundError } from './services/segment-query.js';

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

// Internal dispatch endpoint for Cloudflare Worker modules (no tenant middleware)
app.post('/__dispatch/crm/segments/query', async (c) => {
  try {
    const body = await c.req
      .json<{
        organizationId: string;
        segmentId: string;
        cursor?: string;
        limit?: number;
      }>()
      .catch(() => null);
    if (!body?.organizationId || !body.segmentId) {
      return c.json({ code: 'VALIDATION_ERROR', message: 'organizationId and segmentId required' }, 400);
    }

    const db = createDatabase(c.env.DATABASE_URL);
    const result = await querySegmentContacts(db as any, {
      organizationId: body.organizationId,
      segmentId: body.segmentId,
      cursor: body.cursor,
      limit: body.limit,
    });
    return c.json(result);
  } catch (error) {
    if (error instanceof SegmentNotFoundError) {
      return c.json({ code: 'NOT_FOUND', message: 'Segment not found' }, 404);
    }
    console.error('CRM dispatch segments query failed:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to query segment contacts' }, 500);
  }
});

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
app.route('/', segmentRoutes);

// Mount HTMX view routes (HTML fragments)
app.route('/', viewRoutes);

export default app;
