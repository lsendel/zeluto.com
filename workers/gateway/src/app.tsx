import { Hono } from 'hono';
import { corsMiddleware, loggingMiddleware, csrfMiddleware } from '@mauntic/worker-lib';
import { AppLayout } from '@mauntic/ui-kit';
import type { Env } from './index.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { quotaMiddleware } from './middleware/quota.js';
import { createOnboardingRoutes } from './routes/onboarding.js';
import { LoginView } from './views/onboarding/login.js';

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

  // 7. Quota checking middleware (checks resource quotas via BILLING)
  app.use('/api/v1/*', quotaMiddleware());

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // ========================================
  // /api/v1/me - Current user profile + org + subscription
  // ========================================
  app.get('/api/v1/me', async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }

    const organization = c.get('organization');

    // Build response with user data
    const result: Record<string, unknown> = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            role: organization.role,
            plan: organization.plan,
          }
        : null,
      subscription: null,
    };

    // If user has an org, fetch subscription info from BILLING
    if (organization) {
      try {
        const tenantContext = c.get('tenantContext');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (tenantContext) {
          headers['X-Tenant-Context'] = btoa(JSON.stringify(tenantContext));
        }
        const requestId = c.get('requestId');
        if (requestId) {
          headers['X-Request-Id'] = requestId;
        }

        const billingResponse = await c.env.BILLING.fetch(
          new Request(
            `https://internal/api/v1/billing/subscriptions/${organization.id}`,
            { headers },
          ),
        );

        if (billingResponse.ok) {
          result.subscription = await billingResponse.json();
        }
      } catch (error) {
        // Billing info is non-critical - log and continue
        c.get('logger')?.warn(
          { error: String(error) },
          'Failed to fetch subscription info for /me endpoint',
        );
      }
    }

    return c.json(result);
  });

  // ========================================
  // Service Binding Routes (API)
  // ========================================

  // Identity auth routes (public, no tenant context needed)
  app.all('/api/auth/*', async (c) => {
    return forwardToService(c, c.env.IDENTITY, { skipTenant: true });
  });

  // Billing webhook (public, no tenant context)
  app.post('/api/v1/billing/webhooks/stripe', async (c) => {
    return forwardToService(c, c.env.BILLING, { skipTenant: true });
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

  // Login page - serve HTML login form
  app.get('/login', (c) => {
    const user = c.get('user');
    if (user) {
      const organization = c.get('organization');
      if (!organization) {
        return c.redirect('/app/onboarding/org');
      }
      return c.redirect('/app/dashboard');
    }
    return c.html(<LoginView />);
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
 * Forward request to a downstream service binding with proper headers.
 *
 * - Propagates X-Tenant-Context (base64 JSON) unless skipTenant is set
 * - Propagates X-Request-Id for distributed tracing
 * - Handles service binding errors gracefully
 */
async function forwardToService(
  c: any,
  service: Fetcher,
  options?: { skipTenant?: boolean },
): Promise<Response> {
  const url = new URL(c.req.url);
  const headers = new Headers(c.req.raw.headers);

  // Add tenant context if available and not skipped
  if (!options?.skipTenant) {
    const tenant = c.get('tenantContext');
    if (tenant) {
      headers.set('X-Tenant-Context', btoa(JSON.stringify(tenant)));
    }
  }

  // Forward request ID for distributed tracing
  const requestId = c.get('requestId');
  if (requestId) {
    headers.set('X-Request-Id', requestId);
  }

  try {
    const response = await service.fetch(url.toString(), {
      method: c.req.method,
      headers,
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
      // @ts-ignore - duplex is needed for streaming request bodies
      duplex: 'half',
    });

    return new Response(response.body, response);
  } catch (error) {
    c.get('logger')?.error(
      { error: String(error), url: url.pathname },
      'Service binding fetch failed',
    );

    return c.json(
      {
        error: 'SERVICE_UNAVAILABLE',
        message: 'The requested service is temporarily unavailable',
      },
      503,
    );
  }
}

/**
 * Get page title from path
 */
function getPageTitle(path: string): string {
  const segment = path.split('/').filter(Boolean)[1];
  if (!segment) return 'Dashboard';
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}
