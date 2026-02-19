import {
  startHealthServer,
  createWorker,
  registerScheduledJobs,
  type JobHandler,
  type ScheduledJob,
} from '@mauntic/process-lib';
import pino from 'pino';

const logger = pino({ name: 'scoring-engine' });

// ---------------------------------------------------------------------------
// Job Handlers
// ---------------------------------------------------------------------------

interface ScoringJobData {
  organizationId: string;
  contactId: string;
}

const scoringJobHandler: JobHandler<ScoringJobData> = {
  name: 'scoring:scoring-job',
  concurrency: 10,
  async process(job) {
    const { organizationId, contactId } = job.data;
    logger.info({ organizationId, contactId }, 'Processing scoring job');

    // TODO: Wire up ScoringEngine + repos
    // 1. Load contact features from CRM
    // 2. Score contact via ScoringEngine
    // 3. Check threshold crossings
    // 4. Publish LeadScoredEvent / ScoreThresholdCrossedEvent

    return { success: true, contactId };
  },
};

interface BatchScoringData {
  organizationId: string;
}

const batchScoringHandler: JobHandler<BatchScoringData> = {
  name: 'scoring:batch-scoring',
  concurrency: 2,
  async process(job) {
    const { organizationId } = job.data;
    logger.info({ organizationId }, 'Processing batch scoring');

    // TODO: Find contacts with recent activity, enqueue individual scoring jobs
    return { success: true };
  },
};

const signalDecayHandler: JobHandler<{ type: string }> = {
  name: 'scoring:signal-decay',
  concurrency: 1,
  async process() {
    logger.info('Running signal decay cleanup');

    // TODO: Delete expired signals via IntentSignalRepository.deleteExpired
    return { success: true };
  },
};

const alertExpiryHandler: JobHandler<{ type: string }> = {
  name: 'scoring:alert-expiry',
  concurrency: 1,
  async process() {
    logger.info('Checking for overdue alerts');

    // TODO: Mark overdue alerts via SignalRouter.expireOverdueAlerts
    return { success: true };
  },
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);
  logger.info({ port }, 'Health server started');

  const workers = [
    createWorker('scoring:scoring-job', scoringJobHandler),
    createWorker('scoring:batch-scoring', batchScoringHandler),
    createWorker('scoring:signal-decay', signalDecayHandler),
    createWorker('scoring:alert-expiry', alertExpiryHandler),
  ];

  const batchScoringSchedule: ScheduledJob[] = [
    {
      name: 'batch-scoring',
      pattern: '0 * * * *', // Every hour
      data: { type: 'batch-scoring' },
    },
  ];

  const signalDecaySchedule: ScheduledJob[] = [
    {
      name: 'signal-decay',
      pattern: '0 * * * *', // Every hour
      data: { type: 'signal-decay' },
    },
  ];

  const alertExpirySchedule: ScheduledJob[] = [
    {
      name: 'alert-expiry',
      pattern: '*/15 * * * *', // Every 15 minutes
      data: { type: 'alert-expiry' },
    },
  ];

  await registerScheduledJobs('scoring:batch-scoring', batchScoringSchedule);
  await registerScheduledJobs('scoring:signal-decay', signalDecaySchedule);
  await registerScheduledJobs('scoring:alert-expiry', alertExpirySchedule);

  logger.info('Scoring engine started');

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await Promise.all(workers.map((w) => w.close()));
    server.close();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error(err, 'Failed to start scoring engine');
  process.exit(1);
});
