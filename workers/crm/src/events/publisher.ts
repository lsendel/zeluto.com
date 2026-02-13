import type { DomainEvent } from '@mauntic/domain-kernel';

/**
 * Publish a CRM domain event to the EVENTS queue with tenant metadata.
 *
 * The queue consumer is responsible for fan-out (analytics, journey triggers,
 * integration webhooks, etc.).
 */
export async function publishDomainEvent(
  queue: Queue,
  event: DomainEvent,
  tenantContext: { organizationId: string; userId: string },
): Promise<void> {
  await queue.send({
    type: event.type,
    payload: event,
    metadata: {
      organizationId: tenantContext.organizationId,
      userId: tenantContext.userId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Publish a batch of CRM domain events.
 *
 * Cloudflare Queues `sendBatch` is limited to 100 messages per call.
 */
export async function publishDomainEvents(
  queue: Queue,
  events: DomainEvent[],
  tenantContext: { organizationId: string; userId: string },
): Promise<void> {
  if (events.length === 0) return;

  const messages = events.map((event) => ({
    body: {
      type: event.type,
      payload: event,
      metadata: {
        organizationId: tenantContext.organizationId,
        userId: tenantContext.userId,
        timestamp: new Date().toISOString(),
      },
    },
  }));

  // Cloudflare Queues batch limit is 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    await queue.sendBatch(messages.slice(i, i + BATCH_SIZE));
  }
}
