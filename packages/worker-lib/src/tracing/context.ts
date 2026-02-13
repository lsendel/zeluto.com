import type { Context } from 'hono';

/**
 * Extract tracing headers from a Hono context for propagation
 * to downstream services (CF Worker service bindings or Fly.io HTTP calls).
 *
 * Includes X-Request-Id for distributed tracing correlation
 * and X-Tenant-Context for tenant isolation enforcement.
 */
export function getTracingHeaders(c: Context): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Request-Id': c.get('requestId') || crypto.randomUUID(),
  };

  const tenantHeader = c.get('tenantContext');
  if (tenantHeader) {
    headers['X-Tenant-Context'] = btoa(JSON.stringify(tenantHeader));
  }

  return headers;
}

/**
 * Extract the request correlation ID from incoming headers or context.
 * Generates a new UUID if none exists.
 */
export function getCorrelationId(c: Context): string {
  return (c.get('requestId') as string) || crypto.randomUUID();
}
