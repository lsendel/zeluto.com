import { startHealthServer, createWorker, registerScheduledJobs, getRedis, getDb, type JobHandler } from '@mauntic/process-lib';
import type { Job } from 'bullmq';
import pino from 'pino';
import { AnalyticsService } from './application/analytics-service.js';
import { DrizzleAnalyticsRepository } from '@mauntic/analytics-domain';
import { RedisWarmupCounterStore } from './infrastructure/warmup-counter-store.js';

const logger = pino({ name: 'analytics-aggregator' });

async function createService() {
  const db = getDb();
  const redis = getRedis();
  const warmupStore = new RedisWarmupCounterStore(redis);
  const repo = new DrizzleAnalyticsRepository(db, warmupStore);
  return new AnalyticsService(repo);
}

// ---------------------------------------------------------------------------
// Hourly: Event aggregation
// ---------------------------------------------------------------------------

const hourlyAggregationHandler: JobHandler = {
  name: 'analytics:aggregate-hourly',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting hourly analytics aggregation...');

    try {
      const service = await createService();
      const result = await service.runHourlyAggregation();

      if (result.isFailure) {
        throw new Error(result.getError());
      }

      const data = result.getValue();
      logger.info(
        { aggregatedGroups: data.aggregatedGroups, date: data.timestamp.toISOString() },
        'Hourly aggregation completed',
      );

      return { success: true, aggregatedAt: data.timestamp.toISOString(), groups: data.aggregatedGroups };
    } catch (error) {
      logger.error({ error }, 'Hourly aggregation failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Daily: Report generation
// ---------------------------------------------------------------------------

const dailyReportHandler: JobHandler = {
  name: 'analytics:generate-daily-reports',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting daily report generation...');

    try {
      const service = await createService();
      const result = await service.runDailyReports();

      if (result.isFailure) {
        throw new Error(result.getError());
      }

      const data = result.getValue();
      logger.info(
        { date: data.date, campaigns: data.campaignsProcessed },
        'Daily report generation completed',
      );
      return { success: true, date: data.date, campaigns: data.campaignsProcessed };
    } catch (error) {
      logger.error({ error }, 'Daily report generation failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Monthly: Usage summary
// ---------------------------------------------------------------------------

const monthlyUsageHandler: JobHandler = {
  name: 'analytics:monthly-usage-summary',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting monthly usage summary...');

    try {
      const service = await createService();
      const result = await service.runMonthlyUsage();

      if (result.isFailure) {
        throw new Error(result.getError());
      }

      const count = result.getValue();
      logger.info({ rows: count }, 'Monthly usage summary completed');
      return { success: true, rows: count };
    } catch (error) {
      logger.error({ error }, 'Monthly usage summary failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Daily: Warmup daily send counter reset
// ---------------------------------------------------------------------------

const warmupResetHandler: JobHandler = {
  name: 'analytics:warmup-daily-reset',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting warmup daily send counter reset...');

    try {
      const service = await createService();
      const result = await service.runWarmupReset();

      if (result.isFailure) {
        throw new Error(result.getError());
      }

      const count = result.getValue();
      logger.info({ resetCount: count }, 'Warmup daily send counter reset completed');
      return { success: true, resetCount: count };
    } catch (error) {
      logger.error({ error }, 'Warmup daily reset failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Daily: Score distribution aggregation
// ---------------------------------------------------------------------------

const scoreDistributionHandler: JobHandler = {
  name: 'analytics:score-distribution',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting daily score distribution aggregation...');

    try {
      const service = await createService();
      const result = await service.runScoreDistribution();

      if (result.isFailure) {
        throw new Error(result.getError());
      }
      const count = result.getValue();
      logger.info({ orgs: count }, 'Score distribution aggregation completed');
      return { success: true, orgs: count };
    } catch (error) {
      logger.error({ error }, 'Score distribution aggregation failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Daily: Enrichment metrics aggregation
// ---------------------------------------------------------------------------

const enrichmentMetricsHandler: JobHandler = {
  name: 'analytics:enrichment-metrics',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting daily enrichment metrics aggregation...');

    try {
      const service = await createService();
      const result = await service.runEnrichmentMetrics();

      if (result.isFailure) {
        throw new Error(result.getError());
      }

      const count = result.getValue();
      logger.info({ orgs: count }, 'Enrichment metrics aggregation completed');
      return { success: true, orgs: count };
    } catch (error) {
      logger.error({ error }, 'Enrichment metrics aggregation failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);
  logger.info({ port }, 'Health server started');

  const schedulerDisabled =
    (process.env.DISABLE_SCHEDULER ?? 'true').toLowerCase() === 'true';
  if (schedulerDisabled) {
    logger.warn(
      'DISABLE_SCHEDULER=true (default) — analytics aggregator workers not started because Cloudflare Workers now own these jobs.',
    );
    return;
  }

  // Register scheduled jobs
  await registerScheduledJobs('analytics:aggregate-hourly', [
    { name: 'hourly-event-aggregation', pattern: '0 * * * *' }, // Every hour
  ]);
  await registerScheduledJobs('analytics:generate-daily-reports', [
    { name: 'daily-report-generation', pattern: '0 2 * * *' }, // Daily at 2am
  ]);
  await registerScheduledJobs('analytics:monthly-usage-summary', [
    { name: 'monthly-usage-summary', pattern: '0 3 1 * *' }, // 1st of each month at 3am
  ]);
  await registerScheduledJobs('analytics:warmup-daily-reset', [
    { name: 'warmup-daily-reset', pattern: '0 0 * * *' }, // Daily at midnight
  ]);
  await registerScheduledJobs('analytics:score-distribution', [
    { name: 'daily-score-distribution', pattern: '0 4 * * *' }, // Daily at 4am
  ]);
  await registerScheduledJobs('analytics:enrichment-metrics', [
    { name: 'daily-enrichment-metrics', pattern: '0 5 * * *' }, // Daily at 5am
  ]);

  // Workers process the scheduled jobs
  const hourlyWorker = createWorker('analytics:aggregate-hourly', hourlyAggregationHandler);
  const dailyWorker = createWorker('analytics:generate-daily-reports', dailyReportHandler);
  const monthlyWorker = createWorker('analytics:monthly-usage-summary', monthlyUsageHandler);
  const warmupResetWorker = createWorker('analytics:warmup-daily-reset', warmupResetHandler);
  const scoreDistWorker = createWorker('analytics:score-distribution', scoreDistributionHandler);
  const enrichmentMetricsWorker = createWorker('analytics:enrichment-metrics', enrichmentMetricsHandler);

  const allWorkers = [hourlyWorker, dailyWorker, monthlyWorker, warmupResetWorker, scoreDistWorker, enrichmentMetricsWorker];

  allWorkers.forEach((worker) => {
    worker.on('completed', (job) => {
      logger.info({ jobId: job.id, queue: worker.name }, 'Job completed');
    });
    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, queue: worker.name, error: err }, 'Job failed');
    });
  });

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await Promise.all(allWorkers.map((w) => w.close()));
    const redis = getRedis();
    await redis.quit();
    server.close();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Analytics aggregator service started');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
