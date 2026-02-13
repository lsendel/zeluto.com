import type { MiddlewareHandler } from 'hono';
import type { TenantContext } from '@mauntic/domain-kernel/tenant';

/**
 * Tenant context middleware for domain workers
 * Extracts X-Tenant-Context header (base64-encoded JSON) from Gateway
 * and sets tenant context in Hono context
 */
export function tenantMiddleware(): MiddlewareHandler {
  return async (c, next) => {
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

      c.set('tenant', tenant);
      await next();
    } catch (error) {
      console.error('Failed to parse tenant context:', error);
      return c.json({ error: 'INVALID_TENANT_CONTEXT' }, 400);
    }
  };
}
