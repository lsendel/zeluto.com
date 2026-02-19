import type { MiddlewareHandler } from 'hono';
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import { createLogger, type Logger } from '../logger/index.js';

export interface LoggingOptions {
  datasetBinding?: string;
}

export function loggingMiddleware(
  serviceName: string,
  options?: LoggingOptions,
): MiddlewareHandler {
  return async (c, next) => {
    const requestId =
      c.req.header('X-Request-Id') ?? crypto.randomUUID();
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);

    const datasetBinding = options?.datasetBinding ?? 'LOGS_DATASET';
    const dataset = (c.env as Record<string, unknown> | undefined)?.[
      datasetBinding
    ] as AnalyticsEngineDataset | undefined;

    const logger = createLogger({
      service: serviceName,
      requestId,
      dataset,
    });
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

    if (statusCode >= 500) {
      logger.error(fields, 'request');
    } else if (statusCode >= 400) {
      logger.warn(fields, 'request');
    } else {
      logger.info(fields, 'request');
    }
  };
}
