import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import type { DomainEvent } from '@mauntic/domain-kernel';
import {
  createDatabase,
  createLoggerFromEnv,
  logQueueMetric,
} from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  type ScoringContext,
  ScoringService,
} from '../application/scoring-service.js';
import { DrizzleLeadScoreRepository } from '../infrastructure/drizzle-lead-score-repository.js';

export interface ScoringQueueEnv {
  DATABASE_URL: string;
  EVENTS: Queue;
  LOGS_DATASET?: AnalyticsEngineDataset;
}

export type ScoringJobType =
  | 'scoring.CalculateScore'
  | 'scoring.BatchRecompute'
  | 'scoring.SignalDecay'
  | 'scoring.AlertExpiry';

export type ScoringQueueMessage =
  | {
      type: 'scoring.CalculateScore';
      data: {
        organizationId: string;
        contactId: string;
        context?: ScoringContext;
      };
      scheduledFor?: string;
    }
  | {
      type: 'scoring.BatchRecompute';
      scheduledFor?: string;
    }
  | {
      type: 'scoring.SignalDecay';
      scheduledFor?: string;
    }
  | {
      type: 'scoring.AlertExpiry';
      scheduledFor?: string;
    };

class QueueDomainEventPublisher {
  constructor(private readonly queue: Queue) {}

  async publish(events: DomainEvent[]): Promise<void> {
    if (!events.length) return;
    const messages = events.map((event) => ({ body: event }));
    // Cloudflare queue sendBatch limited to 100
    for (let i = 0; i < messages.length; i += 100) {
      await this.queue.sendBatch(messages.slice(i, i + 100) as any);
    }
  }
}

export async function handleScoringQueue(
  batch: MessageBatch,
  env: ScoringQueueEnv,
): Promise<void> {
  const db = createDatabase(env.DATABASE_URL) as NeonHttpDatabase;
  const repo = new DrizzleLeadScoreRepository(db);
  const publisher = new QueueDomainEventPublisher(env.EVENTS);
  const service = new ScoringService(repo, publisher);
  const queueName = batch.queue ?? 'mauntic-scoring-events';
  const baseLogger = createLoggerFromEnv(
    'scoring-queue',
    env as unknown as Record<string, unknown>,
    {
      requestId: batch.messages[0]?.id ?? crypto.randomUUID(),
      baseFields: { queue: queueName },
    },
  );

  for (const message of batch.messages) {
    const payload = message.body as ScoringQueueMessage;
    const type = payload?.type;
    const startedAt = Date.now();
    const organizationId = extractOrganizationId(payload);
    const metadata = extractMetadata(payload);
    const messageLogger = baseLogger.child({
      messageId: message.id,
      jobType: type ?? 'unknown',
      organizationId: organizationId ?? undefined,
    });

    try {
      switch (type) {
        case 'scoring.CalculateScore': {
          const { organizationId, contactId, context } = payload.data;
          const result = await service.calculateScore(
            String(organizationId),
            String(contactId),
            context ?? {},
          );
          if (result.isFailure) {
            throw new Error(result.getError());
          }
          break;
        }
        case 'scoring.BatchRecompute': {
          await runBatchRecompute(db, payload.scheduledFor);
          break;
        }
        case 'scoring.SignalDecay': {
          await runSignalDecay(db, payload.scheduledFor);
          break;
        }
        case 'scoring.AlertExpiry': {
          await runAlertExpiry(db, payload.scheduledFor);
          break;
        }
        default:
          messageLogger.warn(
            { event: 'queue.job.unknown' },
            'Unknown scoring queue message',
          );
      }
      const durationMs = Date.now() - startedAt;
      message.ack();
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'ack',
        eventType: type,
        durationMs,
        organizationId: organizationId ?? undefined,
        metadata,
      });
      messageLogger.info({ durationMs, event: 'queue.job.success' });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      messageLogger.error(
        {
          durationMs,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          event: 'queue.job.failure',
        },
        'Scoring queue handler failed',
      );
      message.retry();
      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: 'retry',
        eventType: type,
        durationMs,
        organizationId: organizationId ?? undefined,
        metadata,
      });
    }
  }
}

function extractOrganizationId(
  message: ScoringQueueMessage | undefined,
): string | null {
  if (!message) return null;
  if (message.type === 'scoring.CalculateScore') {
    return message.data?.organizationId
      ? String(message.data.organizationId)
      : null;
  }
  return null;
}

function extractMetadata(
  message: ScoringQueueMessage | undefined,
): Record<string, unknown> | undefined {
  if (!message) return undefined;
  if (message.type === 'scoring.CalculateScore') {
    return {
      contactId: message.data?.contactId
        ? String(message.data.contactId)
        : undefined,
    };
  }
  return message.scheduledFor
    ? { scheduledFor: message.scheduledFor }
    : undefined;
}

async function runBatchRecompute(
  db: NeonHttpDatabase,
  scheduledFor?: string,
): Promise<void> {
  console.info(
    { scheduledFor, worker: 'scoring-queue' },
    'Batch scoring placeholder executed (implement aggregation logic)',
  );
  // TODO: Wire up @mauntic/scoring-domain repositories for actual batch recompute.
  void db;
}

async function runSignalDecay(
  db: NeonHttpDatabase,
  scheduledFor?: string,
): Promise<void> {
  console.info(
    { scheduledFor, worker: 'scoring-queue' },
    'Signal decay placeholder executed (implement decay cleanup)',
  );
  void db;
}

async function runAlertExpiry(
  db: NeonHttpDatabase,
  scheduledFor?: string,
): Promise<void> {
  console.info(
    { scheduledFor, worker: 'scoring-queue' },
    'Alert expiry placeholder executed (implement alert checks)',
  );
  void db;
}
