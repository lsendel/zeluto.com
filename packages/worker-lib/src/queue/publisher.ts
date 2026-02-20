import type { DomainEvent } from '@mauntic/domain-kernel/events';

/**
 * Publish a single domain event to a CF Queue.
 * If the event metadata lacks a correlationId, one is generated.
 */
export async function publishEvent<T extends DomainEvent>(
  queue: Queue<T>,
  event: T,
  correlationId?: string,
): Promise<void> {
  const enriched = enrichCorrelationId(event, correlationId);
  await queue.send(enriched);
}

/**
 * Publish a batch of domain events to a CF Queue.
 * Each event gets the same correlationId if provided,
 * otherwise each gets its own generated correlationId.
 */
export async function publishBatch<T extends DomainEvent>(
  queue: Queue<T>,
  events: T[],
  correlationId?: string,
): Promise<void> {
  const messages = events.map((event) => ({
    body: enrichCorrelationId(event, correlationId),
  }));
  await queue.sendBatch(messages);
}

/**
 * Ensure the event metadata contains a correlationId.
 * If an explicit correlationId is provided, use it.
 * If the event already has one, keep it.
 * Otherwise generate a new UUID.
 */
function enrichCorrelationId<T extends DomainEvent>(
  event: T,
  correlationId?: string,
): T {
  if (event.metadata.correlationId && !correlationId) return event;

  return {
    ...event,
    metadata: {
      ...event.metadata,
      correlationId:
        correlationId ?? event.metadata.correlationId ?? crypto.randomUUID(),
    },
  };
}
