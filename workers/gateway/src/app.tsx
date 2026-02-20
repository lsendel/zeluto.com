import { Hono } from 'hono';
import { corsMiddleware, loggingMiddleware, csrfMiddleware } from '@mauntic/worker-lib';
import { AppLayout } from '@mauntic/ui-kit';
import type { Env } from './index.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { quotaMiddleware } from './middleware/quota.js';
import { createOnboardingRoutes } from './routes/onboarding.js';
import { createIdentityRoutes } from './routes/identity.js';
import { LoginView } from './views/onboarding/login.js';
import { getStaticBaseUrl, getAssetContentType } from './utils/static-assets.js';

export function createApp() {
  const app = new Hono<Env>();

  // 1. CORS middleware (allow requests from app domain)
  app.use('*', corsMiddleware(['https://zeluto.com', 'http://localhost:8787']));

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

  // Static assets proxy (R2 / Pages)
  app.get('/assets/*', async (c) => {
    const bucket = c.env.STATIC_ASSETS;
    const key = c.req.path.replace(/^\/assets\//, '');
    if (!bucket || !key) {
      return c.notFound();
    }

    const object = await bucket.get(key);
    if (!object) {
      return c.notFound();
    }

    const isVersioned = !key.includes('latest');
    const headers = new Headers({
      'Content-Type': getAssetContentType(key),
      'Cache-Control': isVersioned
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=300, stale-while-revalidate=300',
    });

    if (object.httpMetadata?.cacheControl) {
      headers.set('Cache-Control', object.httpMetadata.cacheControl);
    }
    if (object.httpMetadata?.contentType) {
      headers.set('Content-Type', object.httpMetadata.contentType);
    }
    if (object.httpMetadata?.contentLanguage) {
      headers.set('Content-Language', object.httpMetadata.contentLanguage);
    }
    if (object.httpEtag) {
      headers.set('ETag', object.httpEtag);
    }
    if (object.uploaded) {
      headers.set('Last-Modified', object.uploaded.toUTCString());
    }

    return new Response(object.body, { headers });
  });

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
        const subscription = await fetchBillingSubscription(c, organization.id);
        if (subscription) {
          result.subscription = subscription;
        }
      } catch (error) {
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

  // OAuth callback — intercept JSON responses from Better Auth's API-flow callbacks
  // and convert them to browser redirects (preserving Set-Cookie for the session).
  app.get('/api/auth/callback/:provider', async (c) => {
    const response = await forwardToService(c, c.env.IDENTITY, { skipTenant: true });
    const contentType = response.headers.get('Content-Type') || '';

    // Better Auth returns JSON when the sign-in was initiated as an API call (fetch + JSON).
    // The browser expects a redirect, so convert JSON 200 → 302.
    if (response.status === 200 && contentType.includes('application/json')) {
      const redirectUrl = '/app/dashboard';
      const headers = new Headers({ Location: redirectUrl });

      // Preserve Set-Cookie headers so the session token is stored
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          headers.append('Set-Cookie', value);
        }
      });

      return new Response(null, { status: 302, headers });
    }

    return response;
  });

  // Identity auth routes (public, no tenant context needed)
  app.all('/api/auth/*', async (c) => {
    return forwardToService(c, c.env.IDENTITY, { skipTenant: true });
  });

  // Billing webhook (public, no tenant context)
  app.post('/api/v1/billing/webhooks/stripe', async (c) => {
    return forwardToService(c, c.env.BILLING, { skipTenant: true });
  });

  // Identity routes (users, organizations, members, invites)
  app.route('/api/v1/identity', createIdentityRoutes());

  // Billing routes
  app.all('/api/v1/billing/*', async (c) => {
    return forwardToService(c, c.env.BILLING);
  });

  // CRM segment query uses dispatch endpoint first, then falls back to HTTP proxy
  app.post('/api/v1/crm/segments/:segmentId/query', async (c) => {
    const response = await forwardCrmSegmentQueryViaDispatch(c);
    if (response) return response;
    return forwardToService(c, c.env.CRM);
  });

  // CRM routes
  app.all('/api/v1/crm/*', async (c) => {
    return forwardToService(c, c.env.CRM);
  });

  // Journey routes
  app.all('/api/v1/journey/*', async (c) => {
    return forwardToService(c, c.env.JOURNEY);
  });

  app.get('/api/v1/delivery/sending-domains', async (c) => {
    const response = await deliveryDispatchRequest(c, 'sending-domains/list', {});
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.post('/api/v1/delivery/sending-domains', async (c) => {
    const domain = await parseDeliveryDomainPayload(c);
    const response = await deliveryDispatchRequest(c, 'sending-domains/create', {
      domain,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.post('/api/v1/delivery/sending-domains/:domainId/verify', async (c) => {
    const response = await deliveryDispatchRequest(c, 'sending-domains/verify', {
      id: c.req.param('domainId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/sending-domains/:domainId/dns-records', async (c) => {
    const response = await deliveryDispatchRequest(c, 'sending-domains/dns-records', {
      id: c.req.param('domainId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.delete('/api/v1/delivery/sending-domains/:domainId', async (c) => {
    const response = await deliveryDispatchRequest(c, 'sending-domains/delete', {
      id: c.req.param('domainId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/jobs', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    const response = await deliveryDispatchRequest(c, 'jobs/list', {
      page,
      limit,
      channel: searchParams.get('channel') ?? undefined,
      status: searchParams.get('status') ?? undefined,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/jobs/:jobId', async (c) => {
    const response = await deliveryDispatchRequest(c, 'jobs/get', {
      id: c.req.param('jobId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/jobs/:jobId/events', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    const response = await deliveryDispatchRequest(c, 'jobs/events', {
      id: c.req.param('jobId'),
      page,
      limit,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/providers', async (c) => {
    const response = await deliveryDispatchRequest(c, 'providers/list', {});
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/providers/:providerId', async (c) => {
    const response = await deliveryDispatchRequest(c, 'providers/get', {
      id: c.req.param('providerId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.post('/api/v1/delivery/providers', async (c) => {
    const payload = await parseDeliveryProviderPayload(c);
    const response = await deliveryDispatchRequest(c, 'providers/create', payload);
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.patch('/api/v1/delivery/providers/:providerId', async (c) => {
    const payload = await parseDeliveryProviderPayload(c);
    const response = await deliveryDispatchRequest(c, 'providers/update', {
      id: c.req.param('providerId'),
      ...payload,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.delete('/api/v1/delivery/providers/:providerId', async (c) => {
    const response = await deliveryDispatchRequest(c, 'providers/delete', {
      id: c.req.param('providerId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.post('/api/v1/delivery/providers/:providerId/test', async (c) => {
    const payload = await parseDeliveryProviderTestPayload(c);
    const response = await deliveryDispatchRequest(c, 'providers/test', {
      id: c.req.param('providerId'),
      ...payload,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/suppressions', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    const response = await deliveryDispatchRequest(c, 'suppressions/list', {
      page: Number.isNaN(page) ? undefined : page,
      limit: Number.isNaN(limit) ? undefined : limit,
      reason: searchParams.get('reason') ?? undefined,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/suppressions/check', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const response = await deliveryDispatchRequest(c, 'suppressions/check', {
      email: searchParams.get('email') ?? undefined,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.post('/api/v1/delivery/suppressions', async (c) => {
    const payload = await parseDeliverySuppressionPayload(c);
    const response = await deliveryDispatchRequest(c, 'suppressions/create', payload);
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.delete('/api/v1/delivery/suppressions/:suppressionId', async (c) => {
    const response = await deliveryDispatchRequest(c, 'suppressions/delete', {
      id: c.req.param('suppressionId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/warmup', async (c) => {
    const response = await deliveryDispatchRequest(c, 'warmup/list', {});
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/delivery/warmup/:domainId/progress', async (c) => {
    const response = await deliveryDispatchRequest(c, 'warmup/progress', {
      id: c.req.param('domainId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.DELIVERY);
  });

  app.get('/api/v1/analytics/overview', async (c) => {
    const response = await analyticsDispatchRequest(c, 'overview', {});
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.get('/api/v1/analytics/campaigns/:campaignId/performance', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const response = await analyticsDispatchRequest(c, 'campaigns/performance', {
      campaignId: c.req.param('campaignId'),
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.get('/api/v1/analytics/journeys/:journeyId/performance', async (c) => {
    const response = await analyticsDispatchRequest(c, 'journeys/performance', {
      journeyId: c.req.param('journeyId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.get('/api/v1/analytics/events', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    const response = await analyticsDispatchRequest(c, 'events/list', {
      page: Number.isNaN(page) ? undefined : page,
      limit: Number.isNaN(limit) ? undefined : limit,
      eventType: searchParams.get('eventType') ?? undefined,
      contactId: searchParams.get('contactId') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.get('/api/v1/analytics/events/aggregates', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const response = await analyticsDispatchRequest(c, 'events/aggregates', {
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      eventType: searchParams.get('eventType') ?? undefined,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.get('/api/v1/analytics/contacts/:contactId/activity', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    const response = await analyticsDispatchRequest(c, 'events/activity', {
      contactId: c.req.param('contactId'),
      page: Number.isNaN(page) ? undefined : page,
      limit: Number.isNaN(limit) ? undefined : limit,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.post('/api/v1/analytics/events', async (c) => {
    const payload = await readJsonBody(c);
    const response = await analyticsDispatchRequest(c, 'events/log', payload ?? {});
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.get('/api/v1/analytics/reports', async (c) => {
    const searchParams = new URL(c.req.url).searchParams;
    const page = Number(searchParams.get('page') ?? '1');
    const limit = Number(searchParams.get('limit') ?? '25');
    const response = await analyticsDispatchRequest(c, 'reports/list', {
      page: Number.isNaN(page) ? undefined : page,
      limit: Number.isNaN(limit) ? undefined : limit,
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.get('/api/v1/analytics/reports/:reportId', async (c) => {
    const response = await analyticsDispatchRequest(c, 'reports/get', {
      id: c.req.param('reportId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.post('/api/v1/analytics/reports', async (c) => {
    const payload = await readJsonBody(c);
    const response = await analyticsDispatchRequest(c, 'reports/create', payload ?? {});
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.patch('/api/v1/analytics/reports/:reportId', async (c) => {
    const payload = await readJsonBody(c);
    const response = await analyticsDispatchRequest(c, 'reports/update', {
      id: c.req.param('reportId'),
      ...(payload ?? {}),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.delete('/api/v1/analytics/reports/:reportId', async (c) => {
    const response = await analyticsDispatchRequest(c, 'reports/delete', {
      id: c.req.param('reportId'),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
  });

  app.post('/api/v1/analytics/reports/:reportId/run', async (c) => {
    const payload = await readJsonBody(c);
    const response = await analyticsDispatchRequest(c, 'reports/run', {
      id: c.req.param('reportId'),
      ...(payload ?? {}),
    });
    if (response) {
      return response;
    }
    return forwardToService(c, c.env.ANALYTICS);
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

  // Lead Intelligence routes
  app.all('/api/v1/lead-intelligence/*', async (c) => {
    return forwardToService(c, c.env.LEAD_INTELLIGENCE);
  });

  // Scoring routes
  app.all('/api/v1/scoring/*', async (c) => {
    return forwardToService(c, c.env.SCORING);
  });

  // Revenue Operations routes
  app.all('/api/v1/revops/*', async (c) => {
    return forwardToService(c, c.env.REVOPS);
  });

  // ========================================
  // Onboarding Routes
  // ========================================
  const onboardingRoutes = createOnboardingRoutes();
  app.route('/app', onboardingRoutes);
  app.route('/api/v1/onboarding', onboardingRoutes);

  // ========================================
  // HTMX View Routes (forward partials to service workers)
  // ========================================

  app.all('/api/v1/lead-intelligence/views/*', async (c) => {
    return forwardToService(c, c.env.LEAD_INTELLIGENCE);
  });

  app.all('/api/v1/scoring/views/*', async (c) => {
    return forwardToService(c, c.env.SCORING);
  });

  app.all('/api/v1/revops/views/*', async (c) => {
    return forwardToService(c, c.env.REVOPS);
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
    const assetsBaseUrl = getStaticBaseUrl(c.env);

    return c.html(
      <AppLayout
        title={getPageTitle(path)}
        currentPath={path}
        userName={user.name}
        userEmail={user.email}
        orgName={organization.name}
        assetsBaseUrl={assetsBaseUrl}
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
    return c.html(<LoginView assetsBaseUrl={getStaticBaseUrl(c.env)} />);
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

async function forwardCrmSegmentQueryViaDispatch(c: any): Promise<Response | null> {
  const dispatch = c.env.CRM_DISPATCH;
  if (!dispatch) {
    return null;
  }

  const tenantContext = c.get('tenantContext');
  if (!tenantContext) {
    return null;
  }

  const requestBody = (await c.req.json().catch(() => null)) as
    | { cursor?: string; limit?: number }
    | null;
  if (!requestBody || typeof requestBody !== 'object') {
    return null;
  }

  const payload = {
    organizationId: tenantContext.organizationId,
    segmentId: c.req.param('segmentId'),
    cursor: typeof requestBody.cursor === 'string' ? requestBody.cursor : undefined,
    limit: typeof requestBody.limit === 'number' ? requestBody.limit : undefined,
  };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Context': encodeTenantHeader(tenantContext),
    };
    const cacheKey = c.get('tenantContextCacheKey');
    if (cacheKey) {
      headers['X-Tenant-Context-Key'] = cacheKey;
    }
    const requestId = c.get('requestId');
    if (requestId) {
      headers['X-Request-Id'] = requestId;
    }

    const response = await dispatch.fetch(
      'https://crm.internal/__dispatch/crm/segments/query',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => '');
      c.get('logger')?.warn(
        {
          status: response.status,
          organizationId: tenantContext.organizationId,
          segmentId: payload.segmentId,
          response: bodyText,
        },
        'CRM dispatch segment query failed, falling back to HTTP service binding',
      );
      return null;
    }

    const clonedBody = await response.text();
    return new Response(clonedBody, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    c.get('logger')?.warn(
      {
        error: String(error),
        organizationId: tenantContext.organizationId,
        segmentId: payload.segmentId,
      },
      'CRM dispatch segment query threw, falling back to HTTP service binding',
    );
    return null;
  }
}

async function fetchBillingSubscription(c: any, organizationId: string): Promise<unknown | null> {
  const requestId = c.get('requestId');
  const dispatch = c.env.BILLING_DISPATCH;
  if (dispatch) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (requestId) {
        headers['X-Request-Id'] = requestId;
      }
      const response = await dispatch.fetch(
        'https://billing.internal/__dispatch/billing/subscription/get',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ organizationId }),
        },
      );
      if (response.ok) {
        return await response.json();
      }
      if (response.status !== 404) {
        const text = await response.text().catch(() => '');
        c.get('logger')?.warn(
          {
            status: response.status,
            organizationId,
            body: text,
          },
          'Billing dispatch subscription query failed, falling back to HTTP binding',
        );
      }
    } catch (error) {
      c.get('logger')?.warn(
        {
          organizationId,
          error: String(error),
        },
        'Billing dispatch subscription threw error, falling back to HTTP binding',
      );
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const tenantContext = c.get('tenantContext');
  if (tenantContext) {
    headers['X-Tenant-Context'] = btoa(JSON.stringify(tenantContext));
  }
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }

  try {
    const response = await c.env.BILLING.fetch(
      new Request('https://internal/api/v1/billing/subscription', {
        headers,
      }),
    );
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    c.get('logger')?.warn(
      {
        organizationId,
        error: String(error),
      },
      'Billing service binding subscription request failed',
    );
  }
  return null;
}

function encodeTenantHeader(tenant: any): string {
  return btoa(JSON.stringify(tenant));
}

async function deliveryDispatchRequest(
  c: any,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<Response | null> {
  const dispatch = c.env.DELIVERY_DISPATCH;
  if (!dispatch) {
    return null;
  }
  const tenant = c.get('tenantContext');
  if (!tenant) {
    return null;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Context': encodeTenantHeader(tenant),
  };
  const cacheKey = c.get('tenantContextCacheKey');
  if (cacheKey) {
    headers['X-Tenant-Context-Key'] = cacheKey;
  }
  const requestId = c.get('requestId');
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }

  try {
    return await dispatch.fetch(
      `https://delivery.internal/__dispatch/delivery/${endpoint}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload ?? {}),
      },
    );
  } catch (error) {
    c.get('logger')?.warn(
      { error: String(error), endpoint },
      'Delivery dispatch request failed, falling back to HTTP service binding',
    );
    return null;
  }
}

async function analyticsDispatchRequest(
  c: any,
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<Response | null> {
  const dispatch = c.env.ANALYTICS_DISPATCH;
  if (!dispatch) {
    return null;
  }
  const tenant = c.get('tenantContext');
  if (!tenant) {
    return null;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Context': encodeTenantHeader(tenant),
  };
  const cacheKey = c.get('tenantContextCacheKey');
  if (cacheKey) {
    headers['X-Tenant-Context-Key'] = cacheKey;
  }
  const requestId = c.get('requestId');
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }

  try {
    return await dispatch.fetch(
      `https://analytics.internal/__dispatch/analytics/${endpoint}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload ?? {}),
      },
    );
  } catch (error) {
    c.get('logger')?.warn(
      { error: String(error), endpoint },
      'Analytics dispatch request failed, falling back to HTTP service binding',
    );
    return null;
  }
}

async function readJsonBody<T = Record<string, unknown>>(c: any): Promise<T | null> {
  const clone = c.req.raw.clone();
  return (await clone.json().catch(() => null)) as T | null;
}

async function parseDeliveryDomainPayload(c: any): Promise<string | undefined> {
  const contentType = c.req.header('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => null)) as { domain?: string } | null;
    return typeof body?.domain === 'string' ? body.domain : undefined;
  }
  const formData = await c.req.parseBody();
  const value = formData?.domain;
  return typeof value === 'string' ? value : undefined;
}

async function parseDeliveryProviderPayload(
  c: any,
): Promise<Record<string, unknown>> {
  const contentType = c.req.header('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    return body ?? {};
  }

  const formData = await c.req.parseBody();
  const payload: Record<string, unknown> = {};
  if (typeof formData?.channel === 'string') payload.channel = formData.channel;
  if (typeof formData?.providerType === 'string') payload.providerType = formData.providerType;
  if (typeof formData?.config === 'string') {
    try {
      payload.config = JSON.parse(formData.config);
    } catch {
      payload.config = undefined;
    }
  }
  if (typeof formData?.isActive === 'string') {
    payload.isActive = formData.isActive === 'true';
  }
  if (typeof formData?.priority === 'string') {
    payload.priority = Number(formData.priority);
  }
  return payload;
}

async function parseDeliveryProviderTestPayload(
  c: any,
): Promise<Record<string, unknown>> {
  const contentType = c.req.header('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    return body ?? {};
  }
  const formData = await c.req.parseBody();
  const payload: Record<string, unknown> = {};
  if (typeof formData?.to === 'string') payload.to = formData.to;
  if (typeof formData?.subject === 'string') payload.subject = formData.subject;
  if (typeof formData?.body === 'string') payload.body = formData.body;
  return payload;
}

async function parseDeliverySuppressionPayload(
  c: any,
): Promise<Record<string, unknown>> {
  const contentType = c.req.header('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    return body ?? {};
  }

  const formData = await c.req.parseBody();
  const payload: Record<string, unknown> = {};
  if (typeof formData?.email === 'string') payload.email = formData.email;
  if (typeof formData?.reason === 'string') payload.reason = formData.reason;
  if (typeof formData?.source === 'string') payload.source = formData.source;
  return payload;
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
      const cacheKey = c.get('tenantContextCacheKey');
      if (cacheKey) {
        headers.set('X-Tenant-Context-Key', cacheKey);
      }
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
      redirect: 'manual',
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
