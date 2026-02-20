import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';

export interface Logger {
  info(data: Record<string, unknown>, msg?: string): void;
  warn(data: Record<string, unknown>, msg?: string): void;
  error(data: Record<string, unknown>, msg?: string): void;
  debug(data: Record<string, unknown>, msg?: string): void;
  child(fields: Record<string, unknown>): Logger;
}

export interface LoggerFactoryOptions {
  service: string;
  requestId: string;
  dataset?: AnalyticsEngineDataset;
  baseFields?: Record<string, unknown>;
}

export interface LoggerFromEnvOptions {
  datasetBinding?: string;
  requestId?: string;
  baseFields?: Record<string, unknown>;
}

export function createLogger({
  service,
  requestId,
  dataset,
  baseFields = {},
}: LoggerFactoryOptions): Logger {
  const emit = (level: string, data: Record<string, unknown>, msg?: string) => {
    const merged = { ...baseFields, ...data };
    const event =
      typeof merged.event === 'string' ? merged.event : (msg ?? 'log');
    const { event: _ignored, ...rest } = merged;
    const entry = {
      level,
      service,
      requestId,
      event,
      timestamp: new Date().toISOString(),
      ...(msg ? { msg } : {}),
      ...rest,
    };

    console.log(JSON.stringify(entry));

    if (dataset) {
      try {
        const indexes: (string | ArrayBuffer | null)[] = [
          service,
          level,
          event,
          typeof rest.organizationId === 'string' ? rest.organizationId : '',
          requestId,
        ];
        const doubles: number[] = [
          typeof rest.durationMs === 'number' ? rest.durationMs : 0,
        ];
        dataset.writeDataPoint({
          indexes,
          doubles,
          blobs: [JSON.stringify(entry)],
        });
      } catch {
        // Avoid recursive failures if Analytics Engine writes fail
      }
    }
  };

  return {
    info: (data: Record<string, unknown>, msg?: string) =>
      emit('info', data, msg),
    warn: (data: Record<string, unknown>, msg?: string) =>
      emit('warn', data, msg),
    error: (data: Record<string, unknown>, msg?: string) =>
      emit('error', data, msg),
    debug: (data: Record<string, unknown>, msg?: string) =>
      emit('debug', data, msg),
    child: (fields: Record<string, unknown>) =>
      createLogger({
        service,
        requestId,
        dataset,
        baseFields: { ...baseFields, ...fields },
      }),
  };
}

export function createLoggerFromEnv(
  service: string,
  env: Record<string, unknown> | undefined,
  options?: LoggerFromEnvOptions,
): Logger {
  const datasetBinding = options?.datasetBinding ?? 'LOGS_DATASET';
  const dataset = env?.[datasetBinding] as AnalyticsEngineDataset | undefined;
  return createLogger({
    service,
    requestId: options?.requestId ?? crypto.randomUUID(),
    dataset,
    baseFields: options?.baseFields,
  });
}
