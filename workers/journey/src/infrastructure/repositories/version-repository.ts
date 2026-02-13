import { eq, and, desc, sql } from 'drizzle-orm';
import { journey_versions } from '@mauntic/journey-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type VersionRow = typeof journey_versions.$inferSelect;
export type VersionInsert = typeof journey_versions.$inferInsert;

export async function findVersionById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<VersionRow | null> {
  const [version] = await db
    .select()
    .from(journey_versions)
    .where(and(eq(journey_versions.id, id), eq(journey_versions.organization_id, orgId)));
  return version ?? null;
}

export async function findVersionsByJourneyId(
  db: NeonHttpDatabase,
  orgId: string,
  journeyId: string,
): Promise<VersionRow[]> {
  return db
    .select()
    .from(journey_versions)
    .where(
      and(
        eq(journey_versions.journey_id, journeyId),
        eq(journey_versions.organization_id, orgId),
      ),
    )
    .orderBy(desc(journey_versions.version_number));
}

export async function findLatestVersion(
  db: NeonHttpDatabase,
  orgId: string,
  journeyId: string,
): Promise<VersionRow | null> {
  const [version] = await db
    .select()
    .from(journey_versions)
    .where(
      and(
        eq(journey_versions.journey_id, journeyId),
        eq(journey_versions.organization_id, orgId),
      ),
    )
    .orderBy(desc(journey_versions.version_number))
    .limit(1);
  return version ?? null;
}

export async function getNextVersionNumber(
  db: NeonHttpDatabase,
  orgId: string,
  journeyId: string,
): Promise<number> {
  const [result] = await db
    .select({ maxVersion: sql<number>`coalesce(max(${journey_versions.version_number}), 0)::int` })
    .from(journey_versions)
    .where(
      and(
        eq(journey_versions.journey_id, journeyId),
        eq(journey_versions.organization_id, orgId),
      ),
    );
  return (result?.maxVersion ?? 0) + 1;
}

export async function createVersion(
  db: NeonHttpDatabase,
  orgId: string,
  data: Omit<VersionInsert, 'id' | 'organization_id' | 'created_at'>,
): Promise<VersionRow> {
  const [version] = await db
    .insert(journey_versions)
    .values({ ...data, organization_id: orgId })
    .returning();
  return version;
}
