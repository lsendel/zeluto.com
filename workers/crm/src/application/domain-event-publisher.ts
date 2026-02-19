import type { DomainEvent } from '@mauntic/domain-kernel';

export interface DomainEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

export class QueueDomainEventPublisher implements DomainEventPublisher {
  constructor(private readonly queue: Queue) {}

  async publish(events: DomainEvent[]): Promise<void> {
    if (!events || events.length === 0) {
      return;
    }

    if (events.length === 1) {
      await this.queue.send(events[0]);
      return;
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events
        .slice(i, i + BATCH_SIZE)
        .map((event) => ({ body: event }));
      await this.queue.sendBatch(batch as any);
    }
  }
}
