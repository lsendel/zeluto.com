import type { MiddlewareHandler } from 'hono';
import type { TenantContext } from '@mauntic/domain-kernel';
import type { Env } from '../index.js';

/**
 * Tenant context middleware
 * Constructs TenantContext from authenticated user's organization
 * Sets X-Tenant-Context header as base64-encoded JSON for downstream workers
 */
export function tenantMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const path = c.req.path;

    // Skip for public/auth routes
    if (
      path.startsWith('/api/auth/') ||
      path === '/login' ||
      path === '/signup' ||
      path === '/health' ||
      path.startsWith('/public/')
    ) {
      return next();
    }

    const organization = c.get('organization');
    const user = c.get('user');

    if (!organization || !user) {
      // Should not happen if auth middleware ran first
      return c.json({ error: 'MISSING_AUTH_CONTEXT' }, 500);
    }

    // Construct tenant context
    const tenantContext: TenantContext = {
      organizationId: organization.id,
      userId: user.id,
      userRole: organization.role,
      plan: organization.plan,
    };

    // Encode as base64 JSON for downstream workers
    const contextJson = JSON.stringify(tenantContext);
    const contextB64 = btoa(contextJson);

    // Set context in Hono context for use in this worker
    c.set('tenantContext', tenantContext);

    // Set header for downstream service binding calls
    c.header('X-Tenant-Context', contextB64);

    await next();
  };
}
