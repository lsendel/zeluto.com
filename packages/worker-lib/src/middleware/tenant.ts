import type { MiddlewareHandler } from 'hono';
import type { TenantContext } from '@mauntic/domain-kernel/tenant';
import {
  cacheTenantContext,
  fetchTenantContext,
} from '../tenant/tenant-context-do.js';
import type { Logger } from '../logger/index.js';

function attachTenant(c: any, tenant: TenantContext) {
  c.set('tenant', tenant);
  c.set('organizationId', tenant.organizationId);
  c.set('userId', tenant.userId);
  const logger = c.get('logger') as Logger | undefined;
  if (logger) {
    c.set(
      'logger',
      logger.child({
        organizationId: tenant.organizationId,
        tenantPlan: tenant.plan,
      }),
    );
  }
}

/**
 * Tenant context middleware for domain workers
 * Extracts X-Tenant-Context header (base64-encoded JSON) from Gateway
 * and sets tenant context in Hono context
 */
export function tenantMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const tenantCache = (c.env as any)?.TENANT_CACHE as DurableObjectNamespace | undefined;
    const kv = (c.env as any)?.KV as KVNamespace | undefined;
    const cacheKey = c.req.header('X-Tenant-Context-Key');
    if (cacheKey && tenantCache) {
      const cached = await fetchTenantContext(tenantCache, cacheKey);
      if (cached) {
        attachTenant(c, cached);
        await next();
        return;
      }
    } else if (cacheKey && kv) {
      const cached = await kv.get(cacheKey);
      if (cached) {
        try {
          const tenant = JSON.parse(cached) as TenantContext;
          attachTenant(c, tenant);
          await next();
          return;
        } catch (error) {
          console.warn('Failed to parse cached tenant context:', error);
        }
      }
    }

    const header = c.req.header('X-Tenant-Context');
    if (!header) {
      return c.json({ error: 'MISSING_TENANT_CONTEXT' }, 400);
    }

    try {
      // Decode base64 JSON
      const contextJson = atob(header);
      const tenant: TenantContext = JSON.parse(contextJson);

      // Validate required fields
      if (!tenant.organizationId || !tenant.userId || !tenant.userRole || !tenant.plan) {
        return c.json({ error: 'INVALID_TENANT_CONTEXT' }, 400);
      }

      attachTenant(c, tenant);
      if (cacheKey) {
        if (tenantCache) {
          await cacheTenantContext(tenantCache, cacheKey, tenant, 300).catch((error) => {
            console.warn('Failed to cache tenant context in DO, falling back to KV:', error);
            if (kv) {
              return kv.put(cacheKey, JSON.stringify(tenant), { expirationTtl: 300 });
            }
            return Promise.resolve();
          });
        } else if (kv) {
          await kv.put(cacheKey, JSON.stringify(tenant), { expirationTtl: 300 });
        }
      }
      await next();
    } catch (error) {
      console.error('Failed to parse tenant context:', error);
      return c.json({ error: 'INVALID_TENANT_CONTEXT' }, 400);
    }
  };
}
