import type {
  JourneyId,
  JourneyVersionId,
  OrganizationId,
} from '@mauntic/domain-kernel';
import type { JourneyVersionRepository } from '@mauntic/journey-domain';
import { JourneyVersion } from '@mauntic/journey-domain';
import { journey_versions } from '@mauntic/journey-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export class DrizzleJourneyVersionRepository
  implements JourneyVersionRepository
{
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(
    orgId: OrganizationId,
    id: JourneyVersionId,
  ): Promise<JourneyVersion | null> {
    const [row] = await this.db
      .select()
      .from(journey_versions)
      .where(
        and(
          eq(journey_versions.id, id),
          eq(journey_versions.organization_id, orgId),
        ),
      )
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findLatestByJourney(
    orgId: OrganizationId,
    journeyId: JourneyId,
  ): Promise<JourneyVersion | null> {
    const [row] = await this.db
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
    return row ? this.mapToEntity(row) : null;
  }

  async findByJourney(
    orgId: OrganizationId,
    journeyId: JourneyId,
  ): Promise<JourneyVersion[]> {
    const rows = await this.db
      .select()
      .from(journey_versions)
      .where(
        and(
          eq(journey_versions.journey_id, journeyId),
          eq(journey_versions.organization_id, orgId),
        ),
      )
      .orderBy(desc(journey_versions.version_number));
    return rows.map((r) => this.mapToEntity(r));
  }

  async save(version: JourneyVersion): Promise<void> {
    const props = version.toProps();
    const [existing] = await this.db
      .select({ id: journey_versions.id })
      .from(journey_versions)
      .where(eq(journey_versions.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(journey_versions)
        .set({
          definition: props.definition,
          published_at: props.publishedAt,
        })
        .where(eq(journey_versions.id, props.id));
    } else {
      await this.db.insert(journey_versions).values({
        id: props.id,
        journey_id: props.journeyId,
        organization_id: props.organizationId,
        version_number: props.versionNumber,
        definition: props.definition,
        published_at: props.publishedAt,
        created_at: props.createdAt,
      });
    }
  }

  async getNextVersionNumber(
    orgId: OrganizationId,
    journeyId: JourneyId,
  ): Promise<number> {
    const [result] = await this.db
      .select({
        maxVersion: sql<number>`coalesce(max(${journey_versions.version_number}), 0)::int`,
      })
      .from(journey_versions)
      .where(
        and(
          eq(journey_versions.journey_id, journeyId),
          eq(journey_versions.organization_id, orgId),
        ),
      );
    return (result?.maxVersion ?? 0) + 1;
  }

  private mapToEntity(
    row: typeof journey_versions.$inferSelect,
  ): JourneyVersion {
    return JourneyVersion.reconstitute({
      id: row.id,
      journeyId: row.journey_id,
      organizationId: row.organization_id,
      versionNumber: row.version_number,
      definition: row.definition as Record<string, unknown>,
      publishedAt: row.published_at ?? null,
      createdAt: row.created_at,
    }).getValue();
  }
}
