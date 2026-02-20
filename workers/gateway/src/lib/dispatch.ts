import type { Context } from 'hono';
import type { Env } from '../index.js';

export interface ServiceBinding {
  dispatch?: Fetcher;
  http: Fetcher;
  serviceName: string;
}

function encodeTenantHeader(tenant: unknown): string {
  return btoa(JSON.stringify(tenant));
}

/**
 * Send a dispatch request to a downstream worker via Durable Object dispatch binding.
 * Returns null if dispatch binding is unavailable or tenant context is missing (caller should
 * fall back to forwardToService).
 */
export async function dispatchRequest(
  c: Context<Env>,
  service: ServiceBinding,
  endpoint: string,
  payload: Record<string, unknown>,
  options?: { skipTenant?: boolean },
): Promise<Response | null> {
  const dispatch = service.dispatch;
  if (!dispatch) return null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!options?.skipTenant) {
    const tenant = c.get('tenantContext');
    if (!tenant) return null;
    headers['X-Tenant-Context'] = encodeTenantHeader(tenant);
    const cacheKey = c.get('tenantContextCacheKey');
    if (cacheKey) {
      headers['X-Tenant-Context-Key'] = cacheKey;
    }
  }

  const requestId = c.get('requestId');
  if (requestId) {
    headers['X-Request-Id'] = requestId;
  }

  try {
    const response = await dispatch.fetch(
      `https://${service.serviceName}.internal/__dispatch/${service.serviceName}/${endpoint}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      },
    );
    return new Response(response.body, response);
  } catch {
    return null;
  }
}
