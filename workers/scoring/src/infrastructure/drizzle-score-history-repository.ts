import {
  ScoreHistory,
  type ScoreHistoryRepository,
} from '@mauntic/scoring-domain';
import { scoreHistory } from '@mauntic/scoring-domain/drizzle';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

function mapToEntity(row: typeof scoreHistory.$inferSelect): ScoreHistory {
  return ScoreHistory.reconstitute({
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    date: row.date,
    totalScore: row.total_score,
    engagementScore: row.engagement_score,
    fitScore: row.fit_score,
    intentScore: row.intent_score,
    createdAt: row.created_at,
  });
}

export class DrizzleScoreHistoryRepository implements ScoreHistoryRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findByContact(
    orgId: string,
    contactId: string,
    options?: { from?: string; to?: string; limit?: number },
  ): Promise<ScoreHistory[]> {
    const conditions: any[] = [
      eq(scoreHistory.organization_id, orgId),
      eq(scoreHistory.contact_id, contactId),
    ];
    if (options?.from) {
      conditions.push(sql`${scoreHistory.date} >= ${options.from}`);
    }
    if (options?.to) {
      conditions.push(sql`${scoreHistory.date} <= ${options.to}`);
    }
    const rows = await this.db
      .select()
      .from(scoreHistory)
      .where(and(...conditions))
      .orderBy(desc(scoreHistory.date))
      .limit(options?.limit ?? 100);
    return rows.map(mapToEntity);
  }

  async save(entry: ScoreHistory): Promise<void> {
    const props = entry.toProps();
    await this.db.insert(scoreHistory).values({
      id: props.id,
      organization_id: props.organizationId,
      contact_id: props.contactId,
      date: props.date,
      total_score: props.totalScore,
      engagement_score: props.engagementScore,
      fit_score: props.fitScore,
      intent_score: props.intentScore,
      created_at: props.createdAt,
    });
  }

  async deleteOlderThan(orgId: string, beforeDate: string): Promise<number> {
    const result = await this.db
      .delete(scoreHistory)
      .where(
        and(
          eq(scoreHistory.organization_id, orgId),
          lt(scoreHistory.date, beforeDate),
        ),
      );
    return result.rowCount ?? 0;
  }
}
