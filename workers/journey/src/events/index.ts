import {
  cacheTenantState,
  createDatabase,
  createLoggerFromEnv,
  fetchTenantState,
  logQueueMetric,
} from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { handleContactCreated } from './contact-event-handler.js';
import { handleDeliveryEvent } from './delivery-event-handler.js';
import { handleFormSubmitted } from './form-event-handler.js';
import {
  handleIntentDetected,
  handleScoreChanged,
} from './score-event-handler.js';
import { handleSegmentChanged } from './segment-event-handler.js';

interface QueueEnv {
  DATABASE_URL: string;
  KV: KVNamespace;
  EVENTS: Queue;
  TENANT_CACHE?: DurableObjectNamespace;
  LOGS_DATASET?: import('@cloudflare/workers-types').AnalyticsEngineDataset;
}

/**
 * Cloudflare Queue consumer for journey-related events.
 * Dispatches events to the appropriate handler based on event type.
 */
export async function handleJourneyQueue(
  batch: MessageBatch,
  env: QueueEnv,
): Promise<void> {
  const db = createDatabase(env.DATABASE_URL) as NeonHttpDatabase;
  const queueName = batch.queue ?? 'mauntic-journey-events';
  const baseLogger = createLoggerFromEnv(
    'journey-queue',
    env as unknown as Record<string, unknown>,
    {
      requestId: batch.messages[0]?.id ?? crypto.randomUUID(),
      baseFields: { queue: queueName },
    },
  );

  for (const msg of batch.messages) {
    const startedAt = Date.now();
    const event = msg.body as Record<string, unknown>;
    const eventType = (event.type as string) ?? (event as any).payload?.type;

    const orgId = extractOrganizationId(event);
    const tenantCacheKey = orgId ? `tenant:${orgId}:system` : null;
    const idempotencyKey = `journey-queue:${msg.id}`;
    let existing: string | null = null;
    if (tenantCacheKey && env.TENANT_CACHE) {
      existing = await fetchTenantState(
        env.TENANT_CACHE,
        tenantCacheKey,
        idempotencyKey,
      );
    } else {
      existing = await env.KV.get(idempotencyKey);
    }
    if (existing) {
      msg.ack();
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'duplicate',
        eventType: eventType ?? 'unknown',
        organizationId: orgId ?? undefined,
      });
      continue;
    }

    const messageLogger = baseLogger.child({
      messageId: msg.id,
      eventType,
      organizationId: orgId,
    });

    try {
      switch (eventType) {
        case 'crm.ContactCreated':
          await handleContactCreated(db, event as any, env.EVENTS);
          break;

        case 'content.FormSubmitted':
          await handleFormSubmitted(db, event as any, env.EVENTS);
          break;

        case 'delivery.MessageDelivered':
        case 'delivery.MessageOpened':
        case 'delivery.MessageClicked':
        case 'delivery.MessageBounced':
          await handleDeliveryEvent(db, event as any, env.EVENTS);
          break;

        case 'scoring.ScoreChanged':
          await handleScoreChanged(db, event as any, env.EVENTS);
          break;

        case 'scoring.IntentDetected':
          await handleIntentDetected(db, event as any, env.EVENTS);
          break;

        case 'crm.ContactSegmentChanged':
          await handleSegmentChanged(db, event as any, env.EVENTS);
          break;

        default:
          // Unknown event type - ack and move on
          break;
      }

      if (tenantCacheKey && env.TENANT_CACHE) {
        await cacheTenantState(
          env.TENANT_CACHE,
          tenantCacheKey,
          idempotencyKey,
          '1',
          86400,
        );
      } else {
        await env.KV.put(idempotencyKey, '1', { expirationTtl: 86400 });
      }
      const durationMs = Date.now() - startedAt;
      msg.ack();
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'ack',
        eventType: eventType ?? 'unknown',
        durationMs,
        organizationId: orgId ?? undefined,
      });
      messageLogger.info({ durationMs, event: 'queue.job.success' });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      msg.retry();
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'retry',
        eventType: eventType ?? 'unknown',
        durationMs,
        organizationId: orgId ?? undefined,
      });
      messageLogger.error(
        {
          durationMs,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          event: 'queue.job.failure',
        },
        `Failed to process event ${eventType}`,
      );
    }
  }
}

function extractOrganizationId(event: Record<string, unknown>): string | null {
  const dataOrg = (event.data as any)?.organizationId;
  if (dataOrg !== undefined && dataOrg !== null) {
    return String(dataOrg);
  }
  const metadataOrg = (event.metadata as any)?.tenantContext?.organizationId;
  if (metadataOrg !== undefined && metadataOrg !== null) {
    return String(metadataOrg);
  }
  return null;
}
