import type { MiddlewareHandler } from 'hono';
import type { QuotaResource } from '@mauntic/domain-kernel';
import type { Env } from '../index.js';

/**
 * Route prefix to quota resource mapping.
 * Only routes that consume countable resources need quota checks.
 * Read-only GET requests are not counted against quotas.
 */
const ROUTE_QUOTA_MAP: Array<{ prefix: string; resource: QuotaResource }> = [
  { prefix: '/api/v1/crm/contacts', resource: 'contacts' },
  { prefix: '/api/v1/delivery/', resource: 'emails_per_month' },
  { prefix: '/api/v1/journey/', resource: 'journeys' },
];

/**
 * HTTP methods that create or modify resources (count against quota).
 * GET/HEAD/OPTIONS/DELETE are not counted.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function getQuotaResource(path: string): QuotaResource | null {
  for (const mapping of ROUTE_QUOTA_MAP) {
    if (path.startsWith(mapping.prefix)) {
      return mapping.resource;
    }
  }
  return null;
}

interface QuotaCheckResponse {
  allowed: boolean;
  current: number;
  limit: number;
  resource: string;
}

/**
 * Quota checking middleware
 * Before forwarding mutating requests to backend workers, checks if
 * the organization has quota remaining for the resource type.
 *
 * Calls BILLING worker's quota check endpoint.
 * Returns 429 with quota info if exceeded.
 */
export function quotaMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const path = c.req.path;
    const method = c.req.method;

    // Only check quotas on mutating requests
    if (!MUTATING_METHODS.has(method)) {
      return next();
    }

    const resource = getQuotaResource(path);
    if (!resource) {
      return next();
    }

    const tenantContext = c.get('tenantContext');
    if (!tenantContext) {
      // No tenant context = can't check quota, let the request through
      return next();
    }

    try {
      const quotaResponse = await c.env.BILLING.fetch(
        new Request('https://internal/api/v1/billing/quota/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Context': btoa(JSON.stringify(tenantContext)),
            ...(c.get('tenantContextCacheKey')
              ? { 'X-Tenant-Context-Key': c.get('tenantContextCacheKey') }
              : {}),
          },
          body: JSON.stringify({
            organizationId: tenantContext.organizationId,
            resource,
          }),
        }),
      );

      if (!quotaResponse.ok) {
        // If billing service is down, fail open (allow request through)
        c.get('logger')?.warn(
          { status: quotaResponse.status, resource },
          'Quota check failed, allowing request through',
        );
        return next();
      }

      const quota = (await quotaResponse.json()) as QuotaCheckResponse;

      if (!quota.allowed) {
        return c.json(
          {
            error: 'QUOTA_EXCEEDED',
            message: `Quota exceeded for ${resource}. Current: ${quota.current}, Limit: ${quota.limit}.`,
            resource,
            current: quota.current,
            limit: quota.limit,
            upgradeUrl: '/app/settings/billing',
          },
          429,
        );
      }

      // Set quota headers for downstream visibility
      c.header('X-Quota-Resource', resource);
      c.header('X-Quota-Remaining', String(quota.limit - quota.current));

      await next();
    } catch (error) {
      // On error, fail open - don't block the request
      c.get('logger')?.error(
        { error: String(error), resource },
        'Quota middleware error, allowing request through',
      );
      await next();
    }
  };
}
