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
import { deliveryRoutes } from './interface/delivery-routes.js';
import { deliveryDispatchRoutes } from './interface/dispatch-routes.js';
import { domainRoutes } from './interface/domain-routes.js';
import { providerRoutes } from './interface/provider-routes.js';
import { suppressionRoutes } from './interface/suppression-routes.js';
import { trackingRoutes } from './interface/tracking-routes.js';
import { warmupRoutes } from './interface/warmup-routes.js';

export interface Env {
  Bindings: {
    DATABASE_URL: string;
    KV: KVNamespace;
    EVENTS: Queue;
    ENCRYPTION_KEY: string;
  };
  Variables: {
    tenant: TenantContext;
    db: NeonHttpDatabase;
  };
}

export function createApp() {
  const app = new Hono<Env>();

  // Global middleware
  app.use('*', logger());
  app.use('*', cors());
  app.use('*', errorHandler());

  // Health check (no auth required)
  app.get('/health', (c) => c.json({ status: 'ok', service: 'delivery' }));

  // Database middleware for all API routes
  app.use('/api/*', async (c, next) => {
    const db = createDatabase(c.env.DATABASE_URL);
    c.set('db', db as NeonHttpDatabase);
    await next();
  });

  // Tracking webhooks do NOT require tenant context - they come from external providers.
  // The tenant is resolved from the provider_message_id in the delivery_events table.
  app.use('/api/v1/delivery/tracking/*', async (c, next) => {
    // Set a dummy tenant for tracking routes since they resolve org from stored events.
    c.set('tenant', {
      organizationId: '',
      userId: '',
      userRole: 'admin',
      plan: 'pro',
    } as TenantContext);
    await next();
  });

  // Tenant context required for all other delivery API routes
  app.use('/api/v1/delivery/send', tenantMiddleware());
  app.use('/api/v1/delivery/send/*', tenantMiddleware());
  app.use('/api/v1/delivery/jobs', tenantMiddleware());
  app.use('/api/v1/delivery/jobs/*', tenantMiddleware());
  app.use('/api/v1/delivery/providers', tenantMiddleware());
  app.use('/api/v1/delivery/providers/*', tenantMiddleware());
  app.use('/api/v1/delivery/suppressions', tenantMiddleware());
  app.use('/api/v1/delivery/suppressions/*', tenantMiddleware());
  app.use('/api/v1/delivery/sending-domains', tenantMiddleware());
  app.use('/api/v1/delivery/sending-domains/*', tenantMiddleware());
  app.use('/api/v1/delivery/warmup', tenantMiddleware());
  app.use('/api/v1/delivery/warmup/*', tenantMiddleware());

  // Mount route handlers
  app.route('/', deliveryRoutes);
  app.route('/', providerRoutes);
  app.route('/', suppressionRoutes);
  app.route('/', domainRoutes);
  app.route('/', warmupRoutes);
  app.route('/', trackingRoutes);
  app.route('/__dispatch/delivery', deliveryDispatchRoutes);

  return app;
}

const app = createApp();
export default app;
