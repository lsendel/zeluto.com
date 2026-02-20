import { providerHealth } from '@mauntic/lead-intelligence-domain/drizzle';
import { and, eq } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type ProviderHealthRow = typeof providerHealth.$inferSelect;
export type ProviderHealthInsert = typeof providerHealth.$inferInsert;

export async function findHealthByProvider(
  db: NeonHttpDatabase,
  orgId: string,
  providerId: string,
): Promise<ProviderHealthRow | null> {
  const [row] = await db
    .select()
    .from(providerHealth)
    .where(
      and(
        eq(providerHealth.organization_id, orgId),
        eq(providerHealth.provider_id, providerId),
      ),
    );
  return row ?? null;
}

export async function findHealthByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<ProviderHealthRow[]> {
  return db
    .select()
    .from(providerHealth)
    .where(eq(providerHealth.organization_id, orgId));
}

export async function upsertHealth(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<ProviderHealthInsert, 'organization_id'>,
): Promise<ProviderHealthRow> {
  const existing = await findHealthByProvider(db, orgId, data.provider_id);

  if (existing) {
    const [row] = await db
      .update(providerHealth)
      .set({ ...data, updated_at: new Date() })
      .where(eq(providerHealth.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(providerHealth)
    .values({ ...data, organization_id: orgId })
    .returning();
  return row;
}
