import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { createDatabase } from '@mauntic/worker-lib';
import { handleCampaignSend } from './campaign-sender.js';
import { calculateAndAwardPoints } from '../services/point-calculator.js';
import { publishPointsAwarded } from './publisher.js';

interface QueueEnv {
  HYPERDRIVE: Hyperdrive;
  KV: KVNamespace;
  EVENTS: Queue;
}

/**
 * Cloudflare Queue consumer for campaign-related events.
 * Dispatches events to the appropriate handler based on event type.
 */
export async function handleCampaignQueue(
  batch: MessageBatch,
  env: QueueEnv,
): Promise<void> {
  const db = createDatabase(env.HYPERDRIVE) as NeonHttpDatabase;

  for (const msg of batch.messages) {
    const event = msg.body as Record<string, unknown>;
    const eventType = (event.type as string) ?? '';

    // Idempotency check via KV
    const idempotencyKey = `campaign-queue:${msg.id}`;
    const existing = await env.KV.get(idempotencyKey);
    if (existing) {
      msg.ack();
      continue;
    }

    try {
      switch (eventType) {
        // Campaign send flow
        case 'campaign.CampaignSent': {
          const data = event.data as { organizationId: string; campaignId: string };
          await handleCampaignSend(db, env.EVENTS, {
            organizationId: String(data.organizationId),
            campaignId: String(data.campaignId),
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

      await env.KV.put(idempotencyKey, '1', { expirationTtl: 86400 });
      msg.ack();
    } catch (error) {
      console.error(`Failed to process event ${eventType}:`, error);
      msg.retry();
    }
  }
}
