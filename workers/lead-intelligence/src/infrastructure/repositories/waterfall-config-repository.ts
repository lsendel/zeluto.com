import { waterfallConfigs } from '@mauntic/lead-intelligence-domain/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type WaterfallConfigRow = typeof waterfallConfigs.$inferSelect;
export type WaterfallConfigInsert = typeof waterfallConfigs.$inferInsert;

export async function findWaterfallByField(
  db: NeonHttpDatabase,
  orgId: string,
  fieldName: string,
): Promise<WaterfallConfigRow | null> {
  const [row] = await db
    .select()
    .from(waterfallConfigs)
    .where(
      and(
        eq(waterfallConfigs.organization_id, orgId),
        eq(waterfallConfigs.field_name, fieldName),
      ),
    );
  return row ?? null;
}

export async function findWaterfallsByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<WaterfallConfigRow[]> {
  return db
    .select()
    .from(waterfallConfigs)
    .where(eq(waterfallConfigs.organization_id, orgId));
}

export async function upsertWaterfall(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<WaterfallConfigInsert, 'organization_id'>,
): Promise<WaterfallConfigRow> {
  const existing = await findWaterfallByField(db, orgId, data.field_name);

  if (existing) {
    const [row] = await db
      .update(waterfallConfigs)
      .set({ ...data, updated_at: new Date() })
      .where(eq(waterfallConfigs.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(waterfallConfigs)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}

export async function deleteWaterfall(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(waterfallConfigs)
    .where(
      and(
        eq(waterfallConfigs.id, id),
        eq(waterfallConfigs.organization_id, orgId),
      ),
    )
    .returning({ id: waterfallConfigs.id });
  return result.length > 0;
}
