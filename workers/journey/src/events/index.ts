import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  createDatabase,
  fetchTenantState,
  cacheTenantState,
} from '@mauntic/worker-lib';
import { handleContactCreated } from './contact-event-handler.js';
import { handleFormSubmitted } from './form-event-handler.js';
import { handleDeliveryEvent } from './delivery-event-handler.js';

interface QueueEnv {
  DATABASE_URL: string;
  KV: KVNamespace;
  EVENTS: Queue;
  TENANT_CACHE?: DurableObjectNamespace;
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

  for (const msg of batch.messages) {
    const event = msg.body as Record<string, unknown>;
    const eventType = (event.type as string) ?? (event as any).payload?.type;

    const orgId = extractOrganizationId(event);
    const tenantCacheKey = orgId ? `tenant:${orgId}:system` : null;
    const idempotencyKey = `journey-queue:${msg.id}`;
    let existing: string | null = null;
    if (tenantCacheKey && env.TENANT_CACHE) {
      existing = await fetchTenantState(env.TENANT_CACHE, tenantCacheKey, idempotencyKey);
    } else {
      existing = await env.KV.get(idempotencyKey);
    }
    if (existing) {
      msg.ack();
      continue;
    }

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

        default:
          // Unknown event type - ack and move on
          break;
      }

      if (tenantCacheKey && env.TENANT_CACHE) {
        await cacheTenantState(env.TENANT_CACHE, tenantCacheKey, idempotencyKey, '1', 86400);
      } else {
        await env.KV.put(idempotencyKey, '1', { expirationTtl: 86400 });
      }
      msg.ack();
    } catch (error) {
      console.error(`Failed to process event ${eventType}:`, error);
      msg.retry();
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
