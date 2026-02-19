import { eq, and } from 'drizzle-orm';
import { enrichmentProviders } from '@mauntic/lead-intelligence-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type EnrichmentProviderRow = typeof enrichmentProviders.$inferSelect;
export type EnrichmentProviderInsert = typeof enrichmentProviders.$inferInsert;

export async function findProviderById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<EnrichmentProviderRow | null> {
  const [row] = await db
    .select()
    .from(enrichmentProviders)
    .where(and(eq(enrichmentProviders.id, id), eq(enrichmentProviders.organization_id, orgId)));
  return row ?? null;
}

export async function findProvidersByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
): Promise<EnrichmentProviderRow[]> {
  return db
    .select()
    .from(enrichmentProviders)
    .where(eq(enrichmentProviders.organization_id, orgId));
}

export async function upsertProvider(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<EnrichmentProviderInsert, 'organization_id'>,
): Promise<EnrichmentProviderRow> {
  const [row] = await db
    .insert(enrichmentProviders)
    .values({ ...data, organization_id: orgId })
    .onConflictDoUpdate({
      target: enrichmentProviders.id,
      set: { ...data, updated_at: new Date() },
    })
    .returning();
  return row;
}

export async function deleteProvider(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(enrichmentProviders)
    .where(and(eq(enrichmentProviders.id, id), eq(enrichmentProviders.organization_id, orgId)))
    .returning({ id: enrichmentProviders.id });
  return result.length > 0;
}
