import type { JourneyId, OrganizationId } from '@mauntic/domain-kernel';
import type { JourneyRepository, JourneyStatus } from '@mauntic/journey-domain';
import { Journey } from '@mauntic/journey-domain';
import { journeys } from '@mauntic/journey-domain/drizzle';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

const JOURNEY_COLUMNS = {
  id: journeys.id,
  organization_id: journeys.organization_id,
  name: journeys.name,
  description: journeys.description,
  status: journeys.status,
  created_by: journeys.created_by,
  created_at: journeys.created_at,
  updated_at: journeys.updated_at,
};

export class DrizzleJourneyRepository implements JourneyRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(
    orgId: OrganizationId,
    id: JourneyId,
  ): Promise<Journey | null> {
    const [row] = await this.db
      .select(JOURNEY_COLUMNS)
      .from(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.organization_id, orgId)))
      .limit(1);
    return row ? this.mapToEntity(row) : null;
  }

  async findByOrganization(
    orgId: OrganizationId,
    pagination: {
      page: number;
      limit: number;
      search?: string;
      status?: JourneyStatus;
    },
  ): Promise<{ data: Journey[]; total: number }> {
    const { page, limit, search, status } = pagination;
    const offset = (page - 1) * limit;

    const conditions = [eq(journeys.organization_id, orgId)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(journeys.name, pattern),
          ilike(journeys.description, pattern),
        )!,
      );
    }

    if (status) {
      conditions.push(eq(journeys.status, status));
    }

    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      this.db
        .select(JOURNEY_COLUMNS)
        .from(journeys)
        .where(where)
        .orderBy(desc(journeys.updated_at))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(journeys)
        .where(where),
    ]);

    return {
      data: rows.map((r) => this.mapToEntity(r)),
      total: countResult[0]?.count ?? 0,
    };
  }

  async save(journey: Journey): Promise<void> {
    const props = journey.toProps();
    const [existing] = await this.db
      .select({ id: journeys.id })
      .from(journeys)
      .where(eq(journeys.id, props.id))
      .limit(1);

    if (existing) {
      await this.db
        .update(journeys)
        .set({
          name: props.name,
          description: props.description,
          status: props.status,
          updated_at: props.updatedAt,
        })
        .where(eq(journeys.id, props.id));
    } else {
      await this.db.insert(journeys).values({
        id: props.id,
        organization_id: props.organizationId,
        name: props.name,
        description: props.description,
        status: props.status,
        created_by: props.createdBy,
        created_at: props.createdAt,
        updated_at: props.updatedAt,
      });
    }
  }

  async delete(orgId: OrganizationId, id: JourneyId): Promise<void> {
    await this.db
      .delete(journeys)
      .where(and(eq(journeys.id, id), eq(journeys.organization_id, orgId)));
  }

  private mapToEntity(row: typeof journeys.$inferSelect): Journey {
    return Journey.reconstitute({
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description ?? null,
      status: row.status as JourneyStatus,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }).getValue();
  }
}
