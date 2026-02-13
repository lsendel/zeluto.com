import type { MiddlewareHandler } from 'hono';

export interface Logger {
  info(data: Record<string, unknown>, msg?: string): void;
  warn(data: Record<string, unknown>, msg?: string): void;
  error(data: Record<string, unknown>, msg?: string): void;
  debug(data: Record<string, unknown>, msg?: string): void;
}

function createLogger(
  service: string,
  requestId: string,
  baseFields?: Record<string, unknown>,
): Logger {
  const log = (
    level: string,
    data: Record<string, unknown>,
    msg?: string,
  ) => {
    console.log(
      JSON.stringify({
        level,
        service,
        requestId,
        ...baseFields,
        ...data,
        msg,
        timestamp: new Date().toISOString(),
      }),
    );
  };

  return {
    info: (data: Record<string, unknown>, msg?: string) =>
      log('info', data, msg),
    warn: (data: Record<string, unknown>, msg?: string) =>
      log('warn', data, msg),
    error: (data: Record<string, unknown>, msg?: string) =>
      log('error', data, msg),
    debug: (data: Record<string, unknown>, msg?: string) =>
      log('debug', data, msg),
  };
}

export function loggingMiddleware(serviceName: string): MiddlewareHandler {
  return async (c, next) => {
    const requestId =
      c.req.header('X-Request-Id') ?? crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);

    // Create logger with base fields; organizationId/userId populated after auth
    const logger = createLogger(serviceName, requestId);
    c.set('logger', logger);

    const start = Date.now();
    await next();

    const durationMs = Date.now() - start;
    const statusCode = c.res.status;
    const organizationId = c.get('organizationId') as string | undefined;
    const userId = c.get('userId') as string | undefined;

    const fields: Record<string, unknown> = {
      method: c.req.method,
      path: c.req.path,
      statusCode,
      durationMs,
    };

    if (organizationId) fields.organizationId = organizationId;
    if (userId) fields.userId = userId;

    // Log at appropriate level based on status code
    if (statusCode >= 500) {
      logger.error(fields, 'request');
    } else if (statusCode >= 400) {
      logger.warn(fields, 'request');
    } else {
      logger.info(fields, 'request');
    }
  };
}
