import { DomainError } from '@mauntic/domain-kernel/errors';
import type { MiddlewareHandler } from 'hono';

export function errorHandler(): MiddlewareHandler {
  return async (c, next) => {
    try {
      await next();
    } catch (err) {
      const requestId = c.get('requestId') ?? 'unknown';

      if (err instanceof DomainError) {
        return c.json(
          {
            error: err.code,
            message: err.message,
            details: err.details,
            requestId,
          },
          err.statusCode as any,
        );
      }

      c.get('logger')?.error({ err, requestId }, 'Unhandled error');

      return c.json(
        {
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          requestId,
        },
        500,
      );
    }
  };
}
