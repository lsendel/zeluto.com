import { eq, and, lt } from 'drizzle-orm';
import { enrichmentCache } from '@mauntic/lead-intelligence-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type EnrichmentCacheRow = typeof enrichmentCache.$inferSelect;

export async function getCacheEntry(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
  fieldName: string,
): Promise<EnrichmentCacheRow | null> {
  const [row] = await db
    .select()
    .from(enrichmentCache)
    .where(and(
      eq(enrichmentCache.organization_id, orgId),
      eq(enrichmentCache.contact_id, contactId),
      eq(enrichmentCache.field_name, fieldName),
    ));
  return row ?? null;
}

export async function setCacheEntry(
  db: NeonHttpDatabase,
  orgId: string,
  data: {
    contactId: string;
    fieldName: string;
    providerId: string;
    value: unknown;
    confidence: string;
    expiresAt: Date;
  },
): Promise<void> {
  // Delete existing entry for this field
  await db
    .delete(enrichmentCache)
    .where(and(
      eq(enrichmentCache.organization_id, orgId),
      eq(enrichmentCache.contact_id, data.contactId),
      eq(enrichmentCache.field_name, data.fieldName),
    ));

  await db.insert(enrichmentCache).values({
    organization_id: orgId,
    contact_id: data.contactId,
    field_name: data.fieldName,
    provider_id: data.providerId,
    value: data.value,
    confidence: data.confidence,
    expires_at: data.expiresAt,
  });
}

export async function invalidateCache(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
  fieldName?: string,
): Promise<void> {
  const conditions = [
    eq(enrichmentCache.organization_id, orgId),
    eq(enrichmentCache.contact_id, contactId),
  ];
  if (fieldName) {
    conditions.push(eq(enrichmentCache.field_name, fieldName));
  }
  await db.delete(enrichmentCache).where(and(...conditions));
}

export async function deleteExpiredCache(
  db: NeonHttpDatabase,
): Promise<number> {
  const result = await db
    .delete(enrichmentCache)
    .where(lt(enrichmentCache.expires_at, new Date()))
    .returning({ id: enrichmentCache.id });
  return result.length;
}
