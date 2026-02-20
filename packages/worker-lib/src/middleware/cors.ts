import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';

export function corsMiddleware(allowedOrigins: string[]): MiddlewareHandler {
  return cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-CSRF-Token',
      'X-Request-Id',
      'X-Tenant-Context',
    ],
    maxAge: 86400,
    credentials: true,
  });
}
