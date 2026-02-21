import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import type { DomainEvent } from '@mauntic/domain-kernel';
import { asContactId, asOrganizationId } from '@mauntic/domain-kernel';
import type {
  IntentSignalRepository,
  LeadScoreRepository,
  SignalAlertRepository,
} from '@mauntic/scoring-domain';
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
import {
  DrizzleIntentSignalRepository,
  DrizzleSignalAlertRepository,
} from '../infrastructure/drizzle-scoring-repositories.js';

export interface ScoringQueueEnv {
  DATABASE_URL: string;
  KV: KVNamespace;
  EVENTS: Queue;
  LOGS_DATASET?: AnalyticsEngineDataset;
}

const DLQ_MAX_ATTEMPTS = 3;
const DLQ_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

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
  const leadScoreRepo = new DrizzleLeadScoreRepository(db);
  const intentSignalRepo = new DrizzleIntentSignalRepository(db);
  const signalAlertRepo = new DrizzleSignalAlertRepository(db);
  const publisher = new QueueDomainEventPublisher(env.EVENTS);
  const service = new ScoringService(leadScoreRepo, publisher);
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
            asOrganizationId(String(organizationId)),
            asContactId(String(contactId)),
            context ?? {},
          );
          if (result.isFailure) {
            throw new Error(result.getError());
          }
          break;
        }
        case 'scoring.BatchRecompute': {
          await runBatchRecompute(leadScoreRepo, env, payload.scheduledFor);
          break;
        }
        case 'scoring.SignalDecay': {
          await runSignalDecay(intentSignalRepo, payload.scheduledFor);
          break;
        }
        case 'scoring.AlertExpiry': {
          await runAlertExpiry(signalAlertRepo, payload.scheduledFor);
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
      const errorMsg =
        error instanceof Error ? error.message : String(error);
      messageLogger.error(
        {
          durationMs,
          error: errorMsg,
          stack: error instanceof Error ? error.stack : undefined,
          event: 'queue.job.failure',
          attempts: message.attempts,
        },
        'Scoring queue handler failed',
      );

      if (message.attempts >= DLQ_MAX_ATTEMPTS) {
        // Retries exhausted — persist to DLQ in KV
        const dlqId = crypto.randomUUID();
        await env.KV.put(
          `dlq:${dlqId}`,
          JSON.stringify({
            id: dlqId,
            type: type ?? 'unknown',
            payload,
            error: errorMsg,
            attempts: message.attempts,
            failedAt: new Date().toISOString(),
          }),
          { expirationTtl: DLQ_TTL_SECONDS },
        );
        message.ack(); // Don't retry again
        messageLogger.warn(
          { dlqId, event: 'queue.job.dlq' },
          'Message moved to DLQ after max retries',
        );
      } else {
        message.retry();
      }

      logQueueMetric({
        queue: queueName,
        messageId: message.id,
        status: message.attempts >= DLQ_MAX_ATTEMPTS ? 'dlq' : 'retry',
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

export async function runBatchRecompute(
  leadScoreRepo: LeadScoreRepository,
  env: ScoringQueueEnv,
  scheduledFor?: string,
): Promise<void> {
  let offset = 0;
  const batchSize = 100;
  let totalEnqueued = 0;

  while (true) {
    const pairs = await leadScoreRepo.findAllContactPairs(batchSize, offset);
    if (pairs.length === 0) break;

    const messages = pairs.map((pair) => ({
      body: {
        type: 'scoring.CalculateScore' as const,
        data: {
          organizationId: pair.organizationId,
          contactId: pair.contactId,
        },
      },
    }));

    for (let i = 0; i < messages.length; i += 100) {
      await env.EVENTS.sendBatch(messages.slice(i, i + 100) as any);
    }

    totalEnqueued += pairs.length;
    offset += batchSize;
    if (pairs.length < batchSize) break;
  }

  console.info(
    { scheduledFor, totalEnqueued, worker: 'scoring-queue' },
    'Batch recompute: enqueued individual score calculations',
  );
}

export async function runSignalDecay(
  intentSignalRepo: IntentSignalRepository,
  scheduledFor?: string,
): Promise<void> {
  const deleted = await intentSignalRepo.deleteAllExpired();
  console.info(
    { scheduledFor, deletedCount: deleted, worker: 'scoring-queue' },
    'Signal decay: cleaned up expired intent signals',
  );
}

export async function runAlertExpiry(
  signalAlertRepo: SignalAlertRepository,
  scheduledFor?: string,
): Promise<void> {
  const expiredCount = await signalAlertRepo.expireOverdue();
  console.info(
    { scheduledFor, expiredCount, worker: 'scoring-queue' },
    'Alert expiry: marked overdue alerts as expired',
  );
}
