import { journey_triggers } from '@mauntic/journey-domain/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type TriggerRow = typeof journey_triggers.$inferSelect;
export type TriggerInsert = typeof journey_triggers.$inferInsert;

export async function findTriggerById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<TriggerRow | null> {
  const [trigger] = await db
    .select()
    .from(journey_triggers)
    .where(
      and(
        eq(journey_triggers.id, id),
        eq(journey_triggers.organization_id, orgId),
      ),
    );
  return trigger ?? null;
}

export async function findTriggersByJourneyId(
  db: NeonHttpDatabase,
  orgId: string,
  journeyId: string,
): Promise<TriggerRow[]> {
  return db
    .select()
    .from(journey_triggers)
    .where(
      and(
        eq(journey_triggers.journey_id, journeyId),
        eq(journey_triggers.organization_id, orgId),
      ),
    );
}

export async function findTriggersByType(
  db: NeonHttpDatabase,
  orgId: string,
  type: string,
): Promise<TriggerRow[]> {
  return db
    .select()
    .from(journey_triggers)
    .where(
      and(
        eq(journey_triggers.type, type),
        eq(journey_triggers.organization_id, orgId),
      ),
    );
}

export async function findAllSegmentTriggers(
  db: NeonHttpDatabase,
): Promise<TriggerRow[]> {
  return db
    .select()
    .from(journey_triggers)
    .where(eq(journey_triggers.type, 'segment'));
}

export async function findAllEventTriggers(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<TriggerRow[]> {
  return db
    .select()
    .from(journey_triggers)
    .where(
      and(
        eq(journey_triggers.type, 'event'),
        eq(journey_triggers.organization_id, orgId),
      ),
    );
}

export async function createTrigger(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<TriggerInsert, 'id' | 'organization_id'>,
): Promise<TriggerRow> {
  const [trigger] = await db
    .insert(journey_triggers)
    .values({ ...data, organization_id: orgId })
    .returning();
  return trigger;
}

export async function deleteTrigger(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(journey_triggers)
    .where(
      and(
        eq(journey_triggers.id, id),
        eq(journey_triggers.organization_id, orgId),
      ),
    )
    .returning({ id: journey_triggers.id });
  return result.length > 0;
}
