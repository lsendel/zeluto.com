import type { DomainEvent } from '@mauntic/domain-kernel';
import { isNull, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

/**
 * Write domain events to an outbox table within the current transaction.
 *
 * The outbox table must have columns: id, event_type, payload, created_at, published_at.
 * Call this inside a `db.transaction()` callback to guarantee atomicity
 * with the domain write.
 *
 * @param tx - The Drizzle transaction handle (use `any` as tx types vary)
 * @param outboxTable - The domain's Drizzle outbox table reference
 * @param events - Domain events to persist
 */
export async function writeToOutbox(
  tx: any,
  outboxTable: any,
  events: DomainEvent[],
): Promise<void> {
  if (events.length === 0) return;

  const rows = events.map((event) => ({
    event_type: event.type,
    payload: event,
  }));

  await tx.insert(outboxTable).values(rows);
}

/**
 * Read unpublished events from the outbox, send them to a Cloudflare Queue,
 * and mark them as published. Returns the number of events drained.
 *
 * Call from a cron trigger or after a successful transaction commit
 * as a best-effort immediate flush.
 *
 * @param db - Drizzle database instance
 * @param outboxTable - The domain's Drizzle outbox table reference
 * @param queue - Cloudflare Queue binding
 * @param batchSize - Max events per drain cycle (default 100)
 */
export async function drainOutbox(
  db: NeonHttpDatabase,
  outboxTable: any,
  queue: Queue,
  batchSize = 100,
): Promise<number> {
  const rows: Array<{ id: string; payload: unknown }> = await db
    .select({
      id: outboxTable.id,
      payload: outboxTable.payload,
    })
    .from(outboxTable)
    .where(isNull(outboxTable.published_at))
    .orderBy(outboxTable.created_at)
    .limit(batchSize);

  if (rows.length === 0) return 0;

  // Publish to Cloudflare Queue (batch limit is 100)
  const QUEUE_BATCH = 100;
  for (let i = 0; i < rows.length; i += QUEUE_BATCH) {
    const batch = rows.slice(i, i + QUEUE_BATCH).map((row) => ({
      body: row.payload,
    }));
    await queue.sendBatch(batch as any);
  }

  // Mark as published
  const ids = rows.map((r) => r.id);
  await db
    .update(outboxTable)
    .set({ published_at: sql`NOW()` })
    .where(sql`${outboxTable.id} = ANY(${ids})`);

  return rows.length;
}
