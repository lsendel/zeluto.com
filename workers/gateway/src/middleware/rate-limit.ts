import type { MiddlewareHandler } from 'hono';
import type { Env } from '../index.js';

interface RateLimitConfig {
  free: number;
  starter: number;
  pro: number;
  enterprise: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'api:default': {
    free: 100, // requests per minute
    starter: 500,
    pro: 2000,
    enterprise: 10000,
  },
  'api:analytics': {
    free: 50,
    starter: 200,
    pro: 1000,
    enterprise: 5000,
  },
};

/**
 * Rate limiting middleware
 * Uses KV to track request counts per org per minute
 * Limits are plan-based (from TenantContext)
 */
export function rateLimitMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const path = c.req.path;

    // Skip rate limiting for auth routes and health checks
    if (
      path.startsWith('/api/auth/') ||
      path === '/health' ||
      path.startsWith('/public/')
    ) {
      return next();
    }

    const tenantContext = c.get('tenantContext');
    if (!tenantContext) {
      // No tenant context = no rate limiting (shouldn't happen after auth)
      return next();
    }

    const { organizationId, plan } = tenantContext;

    // Determine rate limit category
    const category = path.startsWith('/api/v1/analytics')
      ? 'api:analytics'
      : 'api:default';

    const limits = RATE_LIMITS[category];
    const limit = limits[plan];

    const now = new Date();
    const minuteBucket = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`;
    const secondsRemaining = Math.max(1, 60 - now.getUTCSeconds());
    const resetEpoch = Math.floor(now.getTime() / 1000) + secondsRemaining;

    try {
      const rateLimiterId = c.env.RATE_LIMITER.idFromName(organizationId);
      const stub = c.env.RATE_LIMITER.get(rateLimiterId);
      const doResponse = await stub.fetch('https://rate-limiter/increment', {
        method: 'POST',
        body: JSON.stringify({
          category,
          bucket: minuteBucket,
          limit,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!doResponse.ok) {
        throw new Error(`Rate limiter update failed: ${doResponse.status}`);
      }

      const payload = (await doResponse.json()) as {
        allowed: boolean;
        count: number;
      };

      if (!payload.allowed) {
        return c.json(
          {
            error: 'RATE_LIMIT_EXCEEDED',
            message: `Rate limit exceeded. Plan limit: ${limit} requests/minute`,
            retryAfter: secondsRemaining,
          },
          429,
        );
      }

      // Set rate limit headers
      c.header('X-RateLimit-Limit', String(limit));
      c.header(
        'X-RateLimit-Remaining',
        String(Math.max(0, limit - payload.count)),
      );
      c.header('X-RateLimit-Reset', String(resetEpoch));

      await next();
    } catch (error) {
      c.get('logger')?.error({ error }, 'Rate limit middleware error');
      // On error, allow request through (fail open)
      await next();
    }
  };
}
