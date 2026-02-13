import { startHealthServer, createWorker, getRedis, getDb, type JobHandler } from '@mauntic/process-lib';
import type { Job } from 'bullmq';
import pino from 'pino';

const logger = pino({ name: 'journey-executor' });

const journeyStepHandler: JobHandler = {
  name: 'journey:execute-step',
  concurrency: 10,
  async process(job: Job) {
    logger.info({ jobId: job.id, data: job.data }, 'Processing journey step execution');

    const { executionId, stepId, journeyId, contactId } = job.data;

    try {
      // TODO: Load execution state from database
      // TODO: Run step logic based on step type
      // TODO: Enqueue next step if applicable

      logger.info({ jobId: job.id, executionId, stepId }, 'Journey step executed successfully');
      return { success: true, executionId, stepId };
    } catch (error) {
      logger.error({ jobId: job.id, error, executionId, stepId }, 'Journey step execution failed');
      throw error;
    }
  },
};

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);
  logger.info({ port }, 'Health server started');

  const worker = createWorker('journey:execute-step', journeyStepHandler);

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err }, 'Job failed');
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

  logger.info('Journey executor service started');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
