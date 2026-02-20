import { Hono } from 'hono';
import { corsMiddleware, loggingMiddleware, csrfMiddleware } from '@mauntic/worker-lib';
import type { Env } from './index.js';
import { authMiddleware } from './middleware/auth.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { quotaMiddleware } from './middleware/quota.js';
import { forwardToService } from './lib/forward.js';
import { getAssetContentType } from './utils/static-assets.js';
import { createOnboardingRoutes } from './routes/onboarding.js';
import { createIdentityRoutes } from './routes/identity.js';
import { createDeliveryRoutes } from './routes/delivery.js';
import { createAnalyticsRoutes } from './routes/analytics.js';
import { createBillingRoutes } from './routes/billing.js';
import { createCrmRoutes } from './routes/crm.js';
import { createCampaignRoutes } from './routes/campaign.js';
import { createJourneyRoutes } from './routes/journey.js';
import { createContentRoutes } from './routes/content.js';
import { createIntegrationsRoutes } from './routes/integrations.js';
import { createLeadIntelligenceRoutes } from './routes/lead-intelligence.js';
import { createScoringRoutes } from './routes/scoring.js';
import { createRevopsRoutes } from './routes/revops.js';
import { createPageRoutes } from './routes/pages.js';

export function createApp() {
  const app = new Hono<Env>();

  // --- Global Middleware ---
  app.use('*', corsMiddleware(['https://zeluto.com', 'http://localhost:8787']));
  app.use('*', loggingMiddleware('gateway'));
  app.use('*', authMiddleware());
  app.use('*', tenantMiddleware());
  app.use('*', async (c, next) => csrfMiddleware(c.env.KV)(c, next));
  app.use('/api/*', rateLimitMiddleware());
  app.use('/api/v1/*', quotaMiddleware());

  // --- Infrastructure ---
  app.get('/health', (c) => c.json({ status: 'ok' }));

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

  // --- /api/v1/me (cross-cutting: identity + billing) ---
  app.get('/api/v1/me', async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'UNAUTHORIZED' }, 401);
    }

    const organization = c.get('organization');
    const result: Record<string, unknown> = {
      user: { id: user.id, email: user.email, name: user.name },
      organization: organization
        ? { id: organization.id, name: organization.name, role: organization.role, plan: organization.plan }
        : null,
      subscription: null,
    };

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

  // --- Auth (public, pre-identity) ---
  app.get('/api/auth/callback/:provider', async (c) => {
    const response = await forwardToService(c, c.env.IDENTITY, { skipTenant: true });
    const contentType = response.headers.get('Content-Type') || '';

    // Better Auth returns JSON for API-flow callbacks; convert to browser redirect.
    if (response.status === 200 && contentType.includes('application/json')) {
      const headers = new Headers({ Location: '/app/dashboard' });
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          headers.append('Set-Cookie', value);
        }
      });
      return new Response(null, { status: 302, headers });
    }

    return response;
  });

  app.all('/api/auth/*', (c) => forwardToService(c, c.env.IDENTITY, { skipTenant: true }));

  // --- Service Route Modules ---
  app.route('/api/v1/identity', createIdentityRoutes());
  app.route('/api/v1/billing', createBillingRoutes());
  app.route('/api/v1/crm', createCrmRoutes());
  app.route('/api/v1/delivery', createDeliveryRoutes());
  app.route('/api/v1/campaign', createCampaignRoutes());
  app.route('/api/v1/journey', createJourneyRoutes());
  app.route('/api/v1/content', createContentRoutes());
  app.route('/api/v1/analytics', createAnalyticsRoutes());
  app.route('/api/v1/integrations', createIntegrationsRoutes());
  app.route('/api/v1/lead-intelligence', createLeadIntelligenceRoutes());
  app.route('/api/v1/scoring', createScoringRoutes());
  app.route('/api/v1/revops', createRevopsRoutes());

  // --- Onboarding ---
  const onboardingRoutes = createOnboardingRoutes();
  app.route('/app', onboardingRoutes);
  app.route('/api/v1/onboarding', onboardingRoutes);

  // --- SSR Pages ---
  app.route('/', createPageRoutes());

  return app;
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
          { status: response.status, organizationId, body: text },
          'Billing dispatch subscription query failed, falling back to HTTP binding',
        );
      }
    } catch (error) {
      c.get('logger')?.warn(
        { organizationId, error: String(error) },
        'Billing dispatch subscription threw error, falling back to HTTP binding',
      );
    }
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const tenantContext = c.get('tenantContext');
  if (tenantContext) {
    headers['X-Tenant-Context'] = btoa(JSON.stringify(tenantContext));
  }
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }

  try {
    const response = await c.env.BILLING.fetch(
      new Request('https://internal/api/v1/billing/subscription', { headers }),
    );
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    c.get('logger')?.warn(
      { organizationId, error: String(error) },
      'Billing service binding subscription request failed',
    );
  }
  return null;
}
