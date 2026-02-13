import { Hono } from 'hono';
import { corsMiddleware, loggingMiddleware, csrfMiddleware } from '@mauntic/worker-lib';
import { AppLayout } from '@mauntic/ui-kit';
import type { Env } from './index.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';

export function createApp() {
  const app = new Hono<Env>();

  // 1. CORS middleware (allow requests from app domain)
  app.use('*', corsMiddleware(['https://17way.com', 'http://localhost:8787']));

  // 2. Logging middleware (generates X-Request-Id, logs request/response)
  app.use('*', loggingMiddleware('gateway'));

  // 3. Auth middleware (validates session via Identity Worker)
  app.use('*', authMiddleware());

  // 4. Tenant context middleware (constructs TenantContext, sets header)
  app.use('*', tenantMiddleware());

  // 5. CSRF middleware (validates token on mutating requests)
  app.use('*', async (c, next) => {
    return csrfMiddleware(c.env.KV)(c, next);
  });

  // 6. Rate limiting middleware (plan-based limits)
  app.use('/api/*', rateLimitMiddleware());

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // ========================================
  // Service Binding Routes (API)
  // ========================================

  // Identity routes
  app.all('/api/auth/*', async (c) => {
    const response = await c.env.IDENTITY.fetch(c.req.raw);
    return response;
  });

  app.all('/api/v1/identity/*', async (c) => {
    const response = await c.env.IDENTITY.fetch(c.req.raw);
    return response;
  });

  // Billing routes
  app.all('/api/v1/billing/*', async (c) => {
    const response = await c.env.BILLING.fetch(c.req.raw);
    return response;
  });

  // CRM routes
  app.all('/api/v1/crm/*', async (c) => {
    const response = await c.env.CRM.fetch(c.req.raw);
    return response;
  });

  // Journey routes
  app.all('/api/v1/journey/*', async (c) => {
    const response = await c.env.JOURNEY.fetch(c.req.raw);
    return response;
  });

  // Delivery routes
  app.all('/api/v1/delivery/*', async (c) => {
    const response = await c.env.DELIVERY.fetch(c.req.raw);
    return response;
  });

  // Campaign routes
  app.all('/api/v1/campaign/*', async (c) => {
    const response = await c.env.CAMPAIGN.fetch(c.req.raw);
    return response;
  });

  // Content routes
  app.all('/api/v1/content/*', async (c) => {
    const response = await c.env.CONTENT.fetch(c.req.raw);
    return response;
  });

  // Analytics routes
  app.all('/api/v1/analytics/*', async (c) => {
    const response = await c.env.ANALYTICS.fetch(c.req.raw);
    return response;
  });

  // Integrations routes
  app.all('/api/v1/integrations/*', async (c) => {
    const response = await c.env.INTEGRATIONS.fetch(c.req.raw);
    return response;
  });

  // ========================================
  // HTMX Application Shell Routes
  // ========================================

  app.get('/app/*', (c) => {
    const user = c.get('user');
    const organization = c.get('organization');

    if (!user || !organization) {
      return c.redirect('/login');
    }

    const path = c.req.path;

    return c.html(
      <AppLayout
        title={getPageTitle(path)}
        currentPath={path}
        userName={user.name}
        userEmail={user.email}
        orgName={organization.name}
      >
        <div
          id="app-content"
          hx-get={`/api/v1${path.replace('/app', '')}`}
          hx-trigger="load"
          hx-swap="innerHTML"
        >
          <div class="flex items-center justify-center py-12">
            <div class="text-gray-500">Loading...</div>
          </div>
        </div>
      </AppLayout>,
    );
  });

  // Login page (redirect to auth if already authenticated)
  app.get('/login', (c) => {
    const user = c.get('user');
    if (user) {
      return c.redirect('/app/dashboard');
    }
    // Redirect to Identity worker's login page
    return c.redirect('/api/auth/login');
  });

  // Root redirect
  app.get('/', (c) => {
    const user = c.get('user');
    if (user) {
      return c.redirect('/app/dashboard');
    }
    return c.redirect('/login');
  });

  return app;
}

/**
 * Get page title from path
 */
function getPageTitle(path: string): string {
  const segment = path.split('/').filter(Boolean)[1];
  if (!segment) return 'Dashboard';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}
