import { Hono } from 'hono';
import { corsMiddleware, loggingMiddleware, csrfMiddleware } from '@mauntic/worker-lib';
import { AppLayout } from '@mauntic/ui-kit';
import type { Env } from './index.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { createOnboardingRoutes } from './routes/onboarding.js';

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

  /**
   * Helper to forward request to service binding with X-Tenant-Context header
   */
  const forwardToService = async (c: any, service: Fetcher) => {
    const tenantContext = c.get('tenantContext');

    // Clone headers and add X-Tenant-Context if available
    const headers = new Headers(c.req.raw.headers);
    if (tenantContext) {
      const contextJson = JSON.stringify(tenantContext);
      const contextB64 = btoa(contextJson);
      headers.set('X-Tenant-Context', contextB64);
    }

    // Create new request with updated headers
    const request = new Request(c.req.raw.url, {
      method: c.req.raw.method,
      headers,
      body: c.req.raw.body,
      // @ts-ignore - duplex is needed for streaming
      duplex: 'half',
    });

    return service.fetch(request);
  };

  // Identity routes
  app.all('/api/auth/*', async (c) => {
    // Auth routes don't need tenant context
    const response = await c.env.IDENTITY.fetch(c.req.raw);
    return response;
  });

  app.all('/api/v1/identity/*', async (c) => {
    return forwardToService(c, c.env.IDENTITY);
  });

  // Billing routes
  app.all('/api/v1/billing/*', async (c) => {
    return forwardToService(c, c.env.BILLING);
  });

  // CRM routes
  app.all('/api/v1/crm/*', async (c) => {
    return forwardToService(c, c.env.CRM);
  });

  // Journey routes
  app.all('/api/v1/journey/*', async (c) => {
    return forwardToService(c, c.env.JOURNEY);
  });

  // Delivery routes
  app.all('/api/v1/delivery/*', async (c) => {
    return forwardToService(c, c.env.DELIVERY);
  });

  // Campaign routes
  app.all('/api/v1/campaign/*', async (c) => {
    return forwardToService(c, c.env.CAMPAIGN);
  });

  // Content routes
  app.all('/api/v1/content/*', async (c) => {
    return forwardToService(c, c.env.CONTENT);
  });

  // Analytics routes
  app.all('/api/v1/analytics/*', async (c) => {
    return forwardToService(c, c.env.ANALYTICS);
  });

  // Integrations routes
  app.all('/api/v1/integrations/*', async (c) => {
    return forwardToService(c, c.env.INTEGRATIONS);
  });

  // ========================================
  // Onboarding Routes
  // ========================================
  const onboardingRoutes = createOnboardingRoutes();
  app.route('/app', onboardingRoutes);
  app.route('/api/v1/onboarding', onboardingRoutes);

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
      const organization = c.get('organization');
      // If user has no organization, send to onboarding
      if (!organization) {
        return c.redirect('/app/onboarding/org');
      }
      return c.redirect('/app/dashboard');
    }
    // Redirect to Identity worker's login page
    return c.redirect('/api/auth/login');
  });

  // Root redirect
  app.get('/', (c) => {
    const user = c.get('user');
    if (user) {
      const organization = c.get('organization');
      // If user has no organization, send to onboarding
      if (!organization) {
        return c.redirect('/app/onboarding/org');
      }
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
