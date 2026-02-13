import type { DomainEvent } from '@mauntic/domain-kernel/events';

export async function publishEvent<T extends DomainEvent>(
  queue: Queue<T>,
  event: T,
): Promise<void> {
  await queue.send(event);
}

export async function publishBatch<T extends DomainEvent>(
  queue: Queue<T>,
  events: T[],
): Promise<void> {
  const messages = events.map((event) => ({ body: event }));
  await queue.sendBatch(messages);
}
