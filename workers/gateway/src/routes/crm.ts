import { Hono } from 'hono';
import type { Env } from '../index.js';
import { dispatchRequest, type ServiceBinding } from '../lib/dispatch.js';
import { forwardToService } from '../lib/forward.js';

export function createCrmRoutes() {
  const app = new Hono<Env>();

  // Segment query uses dispatch endpoint first, then falls back to HTTP proxy
  app.post('/segments/:segmentId/query', async (c) => {
    const response = await forwardCrmSegmentQueryViaDispatch(c);
    if (response) return response;
    return forwardToService(c, c.env.CRM);
  });

  // All other CRM routes
  app.all('/*', async (c) => {
    return forwardToService(c, c.env.CRM);
  });

  return app;
}

/**
 * CRM segment query dispatch — reads the request body for cursor/limit params,
 * dispatches to the CRM worker, and handles non-ok responses by falling back.
 */
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
      'X-Tenant-Context': btoa(JSON.stringify(tenantContext)),
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
