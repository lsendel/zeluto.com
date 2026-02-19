import { logQueueMetric, createDatabase, createLoggerFromEnv } from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { ScheduledEvent, AnalyticsEngineDataset, R2Bucket } from '@cloudflare/workers-types';
import { AnalyticsService, DrizzleAnalyticsRepository } from '@mauntic/analytics-domain';
import type { Result } from '@mauntic/domain-kernel';
import { KvWarmupCounterStore } from './infrastructure/warmup-counter-store.js';
import { R2WarmupCounterStore } from './infrastructure/r2-warmup-counter-store.js';

export type AnalyticsJobType =
  | 'analytics.aggregate-hourly'
  | 'analytics.generate-daily-reports'
  | 'analytics.monthly-usage-summary'
  | 'analytics.warmup-daily-reset'
  | 'analytics.score-distribution'
  | 'analytics.enrichment-metrics';

export interface AnalyticsJobMessage {
  type: AnalyticsJobType;
  scheduledFor?: string;
  correlationId?: string;
}

export interface AnalyticsQueueEnv {
  DATABASE_URL: string;
  ANALYTICS_JOBS: Queue;
  ENABLE_ANALYTICS_CRON?: string;
  WARMUP_R2?: R2Bucket;
  WARMUP_KV?: KVNamespace;
  LOGS_DATASET?: AnalyticsEngineDataset;
}

type JobExecutor = (service: AnalyticsService) => Promise<Result<unknown>>;

const JOB_EXECUTORS: Record<AnalyticsJobType, JobExecutor> = {
  'analytics.aggregate-hourly': (service) => service.runHourlyAggregation(),
  'analytics.generate-daily-reports': (service) => service.runDailyReports(),
  'analytics.monthly-usage-summary': (service) => service.runMonthlyUsage(),
  'analytics.score-distribution': (service) => service.runScoreDistribution(),
  'analytics.enrichment-metrics': (service) => service.runEnrichmentMetrics(),
  'analytics.warmup-daily-reset': (service) => service.runWarmupReset(),
};

const CRON_TO_JOBS: Record<string, AnalyticsJobType[]> = {
  '0 * * * *': ['analytics.aggregate-hourly'],
  '0 2 * * *': ['analytics.generate-daily-reports'],
  '0 3 1 * *': ['analytics.monthly-usage-summary'],
  '0 4 * * *': ['analytics.score-distribution'],
  '0 5 * * *': ['analytics.enrichment-metrics'],
  '0 0 * * *': ['analytics.warmup-daily-reset'],
};

export async function queue(batch: MessageBatch, env: AnalyticsQueueEnv) {
  const db = createDatabase(env.DATABASE_URL) as NeonHttpDatabase;
  const warmupStore = env.WARMUP_R2
    ? new R2WarmupCounterStore(env.WARMUP_R2)
    : env.WARMUP_KV
    ? new KvWarmupCounterStore(env.WARMUP_KV)
    : undefined;
  const repo = new DrizzleAnalyticsRepository(db, warmupStore);
  const service = new AnalyticsService(repo);
  const queueName = batch.queue ?? 'mauntic-analytics-jobs';
  const baseLogger = createLoggerFromEnv(
    'analytics-queue',
    env as unknown as Record<string, unknown>,
    {
      requestId: batch.messages[0]?.id ?? crypto.randomUUID(),
      baseFields: { queue: queueName },
    },
  );

  for (const message of batch.messages) {
    const startedAt = Date.now();
    const job = normalizeMessage(message.body);

    if (!job) {
      message.ack();
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'ack',
        eventType: 'analytics.unknown',
        durationMs: Date.now() - startedAt,
      });
      continue;
    }

    const handler = JOB_EXECUTORS[job.type];
    if (!handler) {
      message.ack();
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'ack',
        eventType: job.type,
        durationMs: Date.now() - startedAt,
      });
      continue;
    }

    const messageLogger = baseLogger.child({
      messageId: message.id,
      jobType: job?.type ?? 'unknown',
    });

    try {
      const result = await handler(service);
      if (result.isFailure) {
        throw new Error(result.getError());
      }

      const durationMs = Date.now() - startedAt;
      message.ack();
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'ack',
        eventType: job.type,
        durationMs,
      });
      messageLogger.info({ durationMs, event: 'queue.job.success' });
    } catch (error) {
      console.error('Analytics job failed', {
        messageId: message.id,
        type: job.type,
        error,
      });
      message.retry();
      const durationMs = Date.now() - startedAt;
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'retry',
        eventType: job.type,
        durationMs,
      });
      messageLogger.error(
        {
          durationMs,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          event: 'queue.job.failure',
        },
        'Analytics job failed',
      );
    }
  }
}

export async function scheduled(event: ScheduledEvent, env: AnalyticsQueueEnv) {
  if (env.ENABLE_ANALYTICS_CRON && env.ENABLE_ANALYTICS_CRON !== 'true') {
    return;
  }

  const jobs = CRON_TO_JOBS[event.cron] ?? [];
  if (!jobs.length) {
    return;
  }

  const scheduledFor = new Date(event.scheduledTime ?? Date.now()).toISOString();

  await Promise.all(
    jobs.map((type) =>
      env.ANALYTICS_JOBS.send({
        type,
        scheduledFor,
      }),
    ),
  );
}

function normalizeMessage(body: unknown): AnalyticsJobMessage | null {
  if (!body) {
    return null;
  }

  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as AnalyticsJobMessage;
      return parsed?.type ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof body === 'object') {
    const candidate = body as Record<string, unknown>;
    if (typeof candidate.type === 'string') {
      return {
        type: candidate.type as AnalyticsJobType,
        scheduledFor: typeof candidate.scheduledFor === 'string' ? candidate.scheduledFor : undefined,
        correlationId:
          typeof candidate.correlationId === 'string' ? candidate.correlationId : undefined,
      };
    }
  }

  return null;
}
