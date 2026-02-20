import type { Context } from 'hono';
import type { Env } from '../index.js';

/**
 * Forward request to a downstream service binding with proper headers.
 * Propagates X-Tenant-Context and X-Request-Id. Handles errors gracefully.
 */
export async function forwardToService(
  c: Context<Env>,
  service: Fetcher,
  options?: { skipTenant?: boolean },
): Promise<Response> {
  const url = new URL(c.req.url);
  const headers = new Headers(c.req.raw.headers);

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

    return Response.json(
      {
        error: 'SERVICE_UNAVAILABLE',
        message: 'The requested service is temporarily unavailable',
      },
      { status: 503 },
    );
  }
}
