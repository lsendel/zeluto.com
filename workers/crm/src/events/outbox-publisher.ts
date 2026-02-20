import { outbox_events } from '@mauntic/crm-domain/drizzle';
import type { DomainEvent } from '@mauntic/domain-kernel';
import { drainOutbox, writeToOutbox } from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { DomainEventPublisher } from '../application/domain-event-publisher.js';

/**
 * Outbox-backed domain event publisher.
 *
 * Events are written to the `crm.outbox_events` table within the active
 * transaction (provided via `setTransaction()`). After the transaction
 * commits, call `flush()` for best-effort immediate queue delivery.
 * A cron-triggered `drainCrmOutbox()` catches any events that failed
 * to flush.
 */
export class OutboxDomainEventPublisher implements DomainEventPublisher {
  private tx: any = null;

  constructor(
    private readonly db: NeonHttpDatabase,
    private readonly queue: Queue | null,
  ) {}

  /**
   * Set the active transaction handle. Must be called before `publish()`.
   */
  setTransaction(tx: any): void {
    this.tx = tx;
  }

  async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;

    if (this.tx) {
      await writeToOutbox(this.tx, outbox_events, events);
    } else {
      // Fallback: write to outbox outside transaction (less safe, but doesn't lose events)
      await writeToOutbox(this.db, outbox_events, events);
    }
  }

  /**
   * Best-effort flush: drain outbox to queue after transaction commit.
   * Errors are logged but do not propagate — the cron poller will retry.
   */
  async flush(): Promise<void> {
    if (!this.queue) return;
    try {
      await drainOutbox(this.db, outbox_events, this.queue);
    } catch (err) {
      console.error('Outbox flush failed (cron will retry):', err);
    }
  }
}

/**
 * Drain all unpublished CRM outbox events to the queue.
 * Call from a cron trigger handler.
 */
export async function drainCrmOutbox(
  db: NeonHttpDatabase,
  queue: Queue,
  batchSize = 100,
): Promise<number> {
  return drainOutbox(db, outbox_events, queue, batchSize);
}
