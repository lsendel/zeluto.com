import {
  startHealthServer,
  createWorker,
  registerScheduledJobs,
  type JobHandler,
  type ScheduledJob,
  getDb,
  getRedis,
} from '@mauntic/process-lib';
import pino from 'pino';
import { ScoringService } from './application/scoring-service.js';
import { DrizzleLeadScoreRepository } from './infrastructure/repositories/drizzle-lead-score-repository.js';
import type { DomainEvent } from '@mauntic/domain-kernel';

const logger = pino({ name: 'scoring-engine' });

// ---------------------------------------------------------------------------
// Job Handlers
// ---------------------------------------------------------------------------

interface ScoringJobData {
  organizationId: string;
  contactId: string;
  context?: {
    engagement?: number;
    demographic?: number;
    intent?: number;
  };
}

// Event Publisher Adapter — TODO: wire to Redis Streams or Queue
class BullMQEventPublisher {
  async publish(events: DomainEvent[]): Promise<void> {
    logger.info({ count: events.length }, 'Publishing domain events (stub)');
  }
}

async function createScoringService() {
  const db = getDb();
  const repo = new DrizzleLeadScoreRepository(db);
  const publisher = new BullMQEventPublisher();
  return new ScoringService(repo, publisher);
}

const scoringJobHandler: JobHandler<ScoringJobData> = {
  name: 'scoring:scoring-job',
  concurrency: 10,
  async process(job) {
    const { organizationId, contactId, context } = job.data;
    logger.info({ organizationId, contactId }, 'Processing scoring job');

    const service = await createScoringService();
    const result = await service.calculateScore(organizationId, contactId, context || {});

    if (result.isFailure) {
      throw new Error(result.getError());
    }

    return { success: true, contactId, score: result.getValue().totalScore };
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

    // TODO: Implement batch logic via service
    return { success: true };
  },
};

const signalDecayHandler: JobHandler<{ type: string }> = {
  name: 'scoring:signal-decay',
  concurrency: 1,
  async process() {
    logger.info('Running signal decay cleanup');
    return { success: true };
  },
};

const alertExpiryHandler: JobHandler<{ type: string }> = {
  name: 'scoring:alert-expiry',
  concurrency: 1,
  async process() {
    logger.info('Checking for overdue alerts');
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

  // Initialize DB & Redis
  getDb();
  getRedis();

  const schedulerDisabled =
    (process.env.DISABLE_SCHEDULER ?? 'true').toLowerCase() === 'true';
  if (schedulerDisabled) {
    logger.warn(
      'DISABLE_SCHEDULER=true (default) — scoring engine workers not started because Cloudflare Workers now own these jobs.',
    );
    return;
  }

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
