import { startHealthServer, createWorker, registerScheduledJobs, getRedis, type JobHandler } from '@mauntic/process-lib';
import type { Job } from 'bullmq';
import pino from 'pino';

const logger = pino({ name: 'analytics-aggregator' });

const aggregationHandler: JobHandler = {
  name: 'analytics:aggregate',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting analytics aggregation...');

    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - 5 * 60 * 1000);

      // TODO: Aggregate email events into daily stats
      // TODO: Aggregate journey events into daily stats
      // TODO: Aggregate campaign events into daily stats
      // TODO: Aggregate contact activity events

      logger.info(
        { startTime: startTime.toISOString(), endTime: now.toISOString() },
        'Analytics aggregation completed'
      );

      return { success: true, aggregatedAt: now.toISOString() };
    } catch (error) {
      logger.error({ error }, 'Analytics aggregation failed');
      throw error;
    }
  },
};

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);
  logger.info({ port }, 'Health server started');

  // Register the cron schedule (every 5 minutes)
  await registerScheduledJobs('analytics:aggregate', [
    { name: 'aggregate-events', pattern: '*/5 * * * *' },
  ]);

  // Worker processes the scheduled jobs
  const worker = createWorker('analytics:aggregate', aggregationHandler);

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Aggregation job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Aggregation job failed');
  });

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await worker.close();
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
