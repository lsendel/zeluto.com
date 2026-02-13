import type { MiddlewareHandler } from 'hono';

export interface Logger {
  info(data: Record<string, unknown>, msg?: string): void;
  warn(data: Record<string, unknown>, msg?: string): void;
  error(data: Record<string, unknown>, msg?: string): void;
  debug(data: Record<string, unknown>, msg?: string): void;
}

function createLogger(service: string, requestId: string): Logger {
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
    c.set('logger', createLogger(serviceName, requestId));
    c.header('X-Request-Id', requestId);

    const start = Date.now();
    await next();

    c.get('logger').info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        duration: Date.now() - start,
      },
      'request',
    );
  };
}
