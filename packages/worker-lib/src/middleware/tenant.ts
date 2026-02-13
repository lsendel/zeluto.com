import type { MiddlewareHandler } from 'hono';
import type { TenantContext } from '@mauntic/domain-kernel/tenant';

export function tenantMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('X-Tenant-Context');
    if (!header) return c.json({ error: 'MISSING_TENANT' }, 400);

    const tenant: TenantContext = JSON.parse(header);
    c.set('tenant', tenant);
    await next();
  };
}
