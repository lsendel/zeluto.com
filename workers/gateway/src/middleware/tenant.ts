import type { MiddlewareHandler } from 'hono';
import type { TenantContext } from '@mauntic/domain-kernel';
import type { Env } from '../index.js';

/**
 * Tenant context middleware
 * Constructs TenantContext from authenticated user's organization
 * Sets X-Tenant-Context header as base64-encoded JSON for downstream workers
 *
 * The TenantContext includes plan information so downstream workers
 * can enforce plan-specific quota limits and feature gates.
 */
const TENANT_OPTIONAL_PATHS = new Set(['/login', '/signup', '/health']);
const TENANT_OPTIONAL_PREFIXES = [
  '/api/auth/',
  '/api/v1/billing/webhooks/stripe',
  '/public/',
  '/app/signup',
  '/app/onboarding',
  '/api/v1/onboarding',
  '/api/v1/me',
];

function shouldSkipTenantContext(path: string): boolean {
  if (TENANT_OPTIONAL_PATHS.has(path)) return true;
  return TENANT_OPTIONAL_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function tenantMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const path = c.req.path;

    if (shouldSkipTenantContext(path)) {
      return next();
    }

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

    c.set('tenantContext', tenantContext);

    await next();
  };
}
