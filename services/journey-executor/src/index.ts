import {
  createQueue,
  createWorker,
  getDb,
  getRedis,
  type JobHandler,
  registerScheduledJobs,
  type ScheduledJob,
  startHealthServer,
} from '@mauntic/process-lib';
import type { Job } from 'bullmq';
import pino from 'pino';
import { JourneyService } from './application/journey-service.js';
import { DrizzleJourneyRepository } from './infrastructure/repositories/drizzle-journey-repository.js';

const logger = pino({ name: 'journey-executor' });

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);

  // Database & Redis
  const db = getDb();
  const redis = getRedis(); // Redis Client for idempotency

  // Queues
  const emailQueue = createQueue('delivery:send-email');
  const delayedStepQueue = createQueue('journey:delayed-steps');
  const stepQueue = createQueue('journey:execute-step');

  // Repos & Service
  const journeyRepo = new DrizzleJourneyRepository(db);
  const journeyService = new JourneyService(
    journeyRepo,
    emailQueue,
    delayedStepQueue,
    stepQueue,
    redis,
  );

  logger.info({ port }, 'Health server started');

  // Handlers
  const journeyStepHandler: JobHandler = {
    name: 'journey:execute-step',
    concurrency: 10,
    async process(job: Job) {
      await journeyService.executeStep(job.data);
      return { success: true };
    },
  };

  const delayedStepHandler: JobHandler = {
    name: 'journey:delayed-steps',
    concurrency: 5,
    async process(job: Job) {
      await journeyService.processDelayedStep(job.data);
      return { success: true };
    },
  };

  const scoreTriggerHandler: JobHandler = {
    name: 'journey:score-trigger-eval',
    concurrency: 5,
    async process(job: Job) {
      const { organizationId, contactId, score, eventType, signalType } =
        job.data;
      await journeyService.evaluateScoreTriggers(
        organizationId,
        contactId,
        score,
        eventType,
        signalType,
      );
      return { success: true };
    },
  };

  const segmentTriggerHandler: JobHandler = {
    name: 'journey:segment-trigger-eval',
    concurrency: 1,
    async process(_job: Job) {
      await journeyService.evaluateSegmentTriggers();
      return { success: true };
    },
  };

  const cleanupHandler: JobHandler = {
    name: 'journey:stale-execution-cleanup',
    concurrency: 1,
    async process(_job: Job) {
      await journeyService.cleanupStaleExecutions();
      return { success: true };
    },
  };

  // Workers
  const stepWorker = createWorker('journey:execute-step', journeyStepHandler);
  const delayedWorker = createWorker(
    'journey:delayed-steps',
    delayedStepHandler,
  );
  const scoreWorker = createWorker(
    'journey:score-trigger-eval',
    scoreTriggerHandler,
  );
  const segmentWorker = createWorker(
    'journey:segment-trigger-eval',
    segmentTriggerHandler,
  );
  const cleanupWorker = createWorker(
    'journey:stale-execution-cleanup',
    cleanupHandler,
  );

  // Register scheduled jobs
  const scheduledJobs: ScheduledJob[] = [
    {
      name: 'segment-trigger-eval',
      pattern: '0 * * * *',
      data: { type: 'segment-trigger-eval' },
    },
    {
      name: 'stale-execution-cleanup',
      pattern: '0 3 * * *',
      data: { type: 'stale-execution-cleanup' },
    },
  ];

  await registerScheduledJobs('journey:segment-trigger-eval', [
    scheduledJobs[0],
  ]);
  await registerScheduledJobs('journey:stale-execution-cleanup', [
    scheduledJobs[1],
  ]);

  const workers = [
    stepWorker,
    delayedWorker,
    scoreWorker,
    segmentWorker,
    cleanupWorker,
  ];

  for (const worker of workers) {
    worker.on('completed', (job) => {
      logger.info({ jobId: job.id, queue: worker.name }, 'Job completed');
    });
    worker.on('failed', (job, err) => {
      logger.error(
        { jobId: job?.id, queue: worker.name, error: err },
        'Job failed',
      );
    });
  }

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await Promise.all(workers.map((w) => w.close()));
    await redis.quit();
    server.close();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Journey executor service started with all queues');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
