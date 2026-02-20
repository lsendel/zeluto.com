import type { Fetcher } from '@cloudflare/workers-types';
import {
  cacheTenantState,
  createDatabase,
  fetchTenantState,
  logQueueMetric,
} from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  HttpSegmentContactSource,
  StubSegmentContactSource,
} from '../application/segment-contact-source.js';
import { applyDeliveryFeedback } from '../services/campaign-metrics.js';
import { calculateAndAwardPoints } from '../services/point-calculator.js';
import { handleCampaignSend } from './campaign-sender.js';
import { handleFanOutBatch } from './fanout-batch.js';
import { publishPointsAwarded } from './publisher.js';

interface QueueEnv {
  DATABASE_URL: string;
  KV: KVNamespace;
  EVENTS: Queue;
  TENANT_CACHE?: DurableObjectNamespace;
  CRM?: Fetcher;
  CRM_DISPATCH?: Fetcher;
  SERVICE_TENANT_USER_ID?: string;
  SERVICE_TENANT_USER_ROLE?: string;
  SERVICE_TENANT_PLAN?: string;
}

/**
 * Cloudflare Queue consumer for campaign-related events.
 * Dispatches events to the appropriate handler based on event type.
 */
export async function handleCampaignQueue(
  batch: MessageBatch,
  env: QueueEnv,
): Promise<void> {
  const db = createDatabase(env.DATABASE_URL) as NeonHttpDatabase;
  const contactSource = env.CRM
    ? new HttpSegmentContactSource(env.CRM, env.CRM_DISPATCH, {
        systemUserId:
          env.SERVICE_TENANT_USER_ID ?? '00000000-0000-0000-0000-000000000000',
        systemUserRole: env.SERVICE_TENANT_USER_ROLE ?? 'system',
        plan: env.SERVICE_TENANT_PLAN ?? 'enterprise',
      })
    : new StubSegmentContactSource();
  const queueName = batch.queue ?? 'mauntic-campaign-events';

  for (const msg of batch.messages) {
    const event = msg.body as Record<string, unknown>;
    const eventType = (event.type as string) ?? '';
    const startedAt = Date.now();
    const organizationId = extractOrganizationId(event);
    const campaignId = extractCampaignId(event);

    // Idempotency check via KV
    const orgTenantKey = organizationId
      ? `tenant:${organizationId}:system`
      : null;
    const doKey = `campaign-queue:${msg.id}`;
    let existing = null;
    if (orgTenantKey && env.TENANT_CACHE) {
      existing = await fetchTenantState(env.TENANT_CACHE, orgTenantKey, doKey);
    } else {
      existing = await env.KV.get(doKey);
    }
    if (existing) {
      msg.ack();
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'duplicate',
        eventType,
        organizationId: organizationId ?? undefined,
        campaignId: campaignId ?? undefined,
      });
      continue;
    }

    try {
      switch (eventType) {
        // Campaign send flow
        case 'campaign.CampaignSent': {
          const data = event.data as {
            organizationId: string;
            campaignId: string;
          };
          await handleCampaignSend(db, env.EVENTS, {
            organizationId: String(data.organizationId),
            campaignId: String(data.campaignId),
          });
          break;
        }
        case 'campaign.FanOutBatch': {
          const data = event.data as {
            organizationId: string;
            campaignId: string;
            cursor?: string;
          };
          await handleFanOutBatch(db, env.EVENTS, contactSource, {
            organizationId: String(data.organizationId),
            campaignId: String(data.campaignId),
            cursor: data.cursor ? String(data.cursor) : undefined,
          });
          break;
        }

        // Point system - award points based on delivery events
        case 'delivery.MessageOpened':
        case 'delivery.MessageClicked': {
          const data = event.data as {
            organizationId: number;
            contactId: number;
            deliveryJobId: string;
          };
          await maybeApplyDeliveryFeedback(
            db,
            String(data.organizationId),
            event,
            eventType,
          );
          const points = await calculateAndAwardPoints(
            db,
            String(data.organizationId),
            String(data.contactId),
            eventType,
            { deliveryJobId: data.deliveryJobId },
          );
          if (points > 0) {
            await publishPointsAwarded(env.EVENTS, {
              organizationId: String(data.organizationId),
              contactId: String(data.contactId),
              points,
              reason: eventType,
            });
          }
          break;
        }
        case 'delivery.MessageSent':
        case 'delivery.MessageDelivered':
        case 'delivery.MessageBounced':
        case 'delivery.MessageComplained':
        case 'delivery.MessageUnsubscribed': {
          const orgId = extractOrganizationId(event);
          if (orgId) {
            await maybeApplyDeliveryFeedback(db, orgId, event, eventType);
          }
          break;
        }

        // Point system - award points for form submissions
        case 'content.FormSubmitted': {
          const data = event.data as {
            organizationId: number;
            contactId?: number;
            formId: number;
          };
          if (data.contactId) {
            const points = await calculateAndAwardPoints(
              db,
              String(data.organizationId),
              String(data.contactId),
              eventType,
              { formId: data.formId },
            );
            if (points > 0) {
              await publishPointsAwarded(env.EVENTS, {
                organizationId: String(data.organizationId),
                contactId: String(data.contactId),
                points,
                reason: eventType,
              });
            }
          }
          break;
        }

        // Point system - award points for page visits
        case 'content.PageVisited': {
          const data = event.data as {
            organizationId: number;
            contactId?: number;
            pageId: number;
          };
          if (data.contactId) {
            const points = await calculateAndAwardPoints(
              db,
              String(data.organizationId),
              String(data.contactId),
              eventType,
              { pageId: data.pageId },
            );
            if (points > 0) {
              await publishPointsAwarded(env.EVENTS, {
                organizationId: String(data.organizationId),
                contactId: String(data.contactId),
                points,
                reason: eventType,
              });
            }
          }
          break;
        }

        default:
          // Unknown event type - ack and move on
          break;
      }

      if (orgTenantKey && env.TENANT_CACHE) {
        await cacheTenantState(
          env.TENANT_CACHE,
          orgTenantKey,
          doKey,
          '1',
          86400,
        );
      } else {
        await env.KV.put(doKey, '1', { expirationTtl: 86400 });
      }
      msg.ack();
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'ack',
        eventType,
        durationMs: Date.now() - startedAt,
        organizationId: organizationId ?? undefined,
        campaignId: campaignId ?? undefined,
      });
    } catch (error) {
      console.error(`Failed to process event ${eventType}:`, error);
      msg.retry();
      logQueueMetric({
        queue: queueName,
        messageId: msg.id,
        status: 'retry',
        eventType,
        durationMs: Date.now() - startedAt,
        organizationId: organizationId ?? undefined,
        campaignId: campaignId ?? undefined,
      });
    }
  }
}

async function maybeApplyDeliveryFeedback(
  db: NeonHttpDatabase,
  orgId: string,
  event: Record<string, unknown>,
  eventType: string,
): Promise<void> {
  const campaignId = extractCampaignId(event);
  if (!campaignId) return;
  await applyDeliveryFeedback(db, orgId, campaignId, eventType);
}

function extractOrganizationId(event: Record<string, unknown>): string | null {
  const data = event.data as { organizationId?: number | string } | undefined;
  if (data?.organizationId !== undefined && data.organizationId !== null) {
    return String(data.organizationId);
  }
  const tenantContext = (event.metadata as any)?.tenantContext;
  if (tenantContext?.organizationId) {
    return String(tenantContext.organizationId);
  }
  return null;
}

function extractCampaignId(event: Record<string, unknown>): string | null {
  const data = event.data as { campaignId?: string | number } | undefined;
  if (data?.campaignId) {
    return String(data.campaignId);
  }
  const correlationId = (event.metadata as any)?.correlationId;
  if (correlationId) {
    return String(correlationId);
  }
  return null;
}

export type CampaignQueueEnv = QueueEnv;
