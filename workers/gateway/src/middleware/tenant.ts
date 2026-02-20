import type { TenantContext } from '@mauntic/domain-kernel';
import type { Logger } from '@mauntic/worker-lib';
import { cacheTenantContext } from '@mauntic/worker-lib';
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../index.js';

/**
 * Tenant context middleware
 * Constructs TenantContext from authenticated user's organization
 * Sets X-Tenant-Context header as base64-encoded JSON for downstream workers
 *
 * The TenantContext includes plan information so downstream workers
 * can enforce plan-specific quota limits and feature gates.
 */
function attachTenantContext(c: any, tenantContext: TenantContext): void {
  const logger = c.get('logger') as Logger | undefined;
  c.set('tenantContext', tenantContext);
  c.set('organizationId', tenantContext.organizationId);
  c.set('userId', tenantContext.userId);
  if (logger) {
    c.set(
      'logger',
      logger.child({
        organizationId: tenantContext.organizationId,
        tenantPlan: tenantContext.plan,
      }),
    );
  }
}

export function tenantMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const organization = c.get('organization');
    const user = c.get('user');

    if (!organization || !user) {
      // If user is authenticated but has no org, the auth middleware
      // should have already redirected them. This is a safety fallback.
      return c.json({ error: 'TENANT_CONTEXT_REQUIRED' }, 412);
    }

    const tenantContext: TenantContext = {
      organizationId: organization.id,
      userId: user.id,
      userRole: organization.role,
      plan: organization.plan,
    };

    attachTenantContext(c, tenantContext);

    // Pre-compute encoded header for proxy requests to save CPU cycles
    const encodedContext = btoa(JSON.stringify(tenantContext));
    c.set('tenantContextHeader', encodedContext);

    const cacheKey = `tenant:${tenantContext.organizationId}:${tenantContext.userId}`;
    const tenantCache = c.env.TENANT_CACHE;
    if (tenantCache) {
      await cacheTenantContext(tenantCache, cacheKey, tenantContext, 300).catch(
        (error) => {
          c.get('logger')?.warn(
            { error: String(error), cacheKey, event: 'tenant.cache.fallback' },
            'Tenant context DO cache write failed, falling back to KV',
          );
          return c.env.KV.put(cacheKey, JSON.stringify(tenantContext), {
            expirationTtl: 300,
          });
        },
      );
    } else {
      await c.env.KV.put(cacheKey, JSON.stringify(tenantContext), {
        expirationTtl: 300,
      });
    }
    c.set('tenantContextCacheKey', cacheKey);

    await next();
  };
}
