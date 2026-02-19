import { eq, and, desc, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { LeadScore, type LeadScoreRepository } from '@mauntic/scoring-domain';
import { leadScores } from '@mauntic/scoring-domain/drizzle';

function mapToEntity(row: typeof leadScores.$inferSelect): LeadScore {
  return LeadScore.reconstitute({
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    totalScore: row.total_score,
    grade: row.grade as any,
    engagementScore: row.engagement_score,
    fitScore: row.fit_score,
    intentScore: row.intent_score,
    components: row.components as Record<string, number>,
    topContributors: row.top_contributors as any,
    scoredAt: row.scored_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export class DrizzleLeadScoreRepository implements LeadScoreRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findByContact(orgId: string, contactId: string): Promise<LeadScore | null> {
    const [row] = await this.db
      .select()
      .from(leadScores)
      .where(and(eq(leadScores.organization_id, orgId), eq(leadScores.contact_id, contactId)));
    if (!row) return null;
    return mapToEntity(row);
  }

  async findByOrganization(
    orgId: string,
    options?: { minScore?: number; grade?: string; limit?: number; offset?: number },
  ): Promise<LeadScore[]> {
    let query = this.db.select().from(leadScores).where(eq(leadScores.organization_id, orgId));
    if (options?.minScore) {
      query = query.where(sql`${leadScores.total_score} >= ${options.minScore}`) as any;
    }
    if (options?.grade) {
      query = query.where(eq(leadScores.grade, options.grade as any)) as any;
    }
    const rows = await query.limit(options?.limit ?? 20).offset(options?.offset ?? 0);
    return rows.map(mapToEntity);
  }

  async findLeaderboard(orgId: string, limit: number): Promise<LeadScore[]> {
    const rows = await this.db
      .select()
      .from(leadScores)
      .where(eq(leadScores.organization_id, orgId))
      .orderBy(desc(leadScores.total_score))
      .limit(limit);
    return rows.map(mapToEntity);
  }

  async save(leadScore: LeadScore): Promise<void> {
    const props = leadScore.toProps();
    await this.db
      .insert(leadScores)
      .values({
        id: props.id,
        organization_id: props.organizationId,
        contact_id: props.contactId,
        total_score: props.totalScore,
        grade: props.grade,
        engagement_score: props.engagementScore,
        fit_score: props.fitScore,
        intent_score: props.intentScore,
        components: props.components,
        top_contributors: props.topContributors,
        scored_at: props.scoredAt,
        created_at: props.createdAt,
        updated_at: props.updatedAt,
      })
      .onConflictDoUpdate({
        target: [leadScores.organization_id, leadScores.contact_id],
        set: {
          total_score: props.totalScore,
          grade: props.grade,
          engagement_score: props.engagementScore,
          fit_score: props.fitScore,
          intent_score: props.intentScore,
          components: props.components,
          top_contributors: props.topContributors,
          scored_at: props.scoredAt,
          updated_at: props.updatedAt,
        },
      });
  }

  async delete(orgId: string, contactId: string): Promise<void> {
    await this.db
      .delete(leadScores)
      .where(and(eq(leadScores.organization_id, orgId), eq(leadScores.contact_id, contactId)));
  }
}
