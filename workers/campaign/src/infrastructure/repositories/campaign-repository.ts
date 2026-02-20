import {
  Campaign,
  type CampaignProps,
  type CampaignRepository,
} from '@mauntic/campaign-domain';
import {
  campaignStats,
  campaignSummaries,
  campaigns,
} from '@mauntic/campaign-domain/drizzle';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export class DrizzleCampaignRepository implements CampaignRepository {
  constructor(private readonly db: NeonHttpDatabase) {}

  async findById(orgId: string, id: string): Promise<Campaign | null> {
    const [row] = await this.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, orgId)));

    if (!row) return null;

    return this.mapToEntity(row);
  }

  async findByOrganization(
    orgId: string,
    pagination: {
      page: number;
      limit: number;
      status?: string;
      search?: string;
    },
  ): Promise<{ data: Campaign[]; total: number }> {
    const { page, limit, status, search } = pagination;
    const offset = (page - 1) * limit;

    const conditions = [eq(campaignSummaries.organizationId, orgId)];
    if (status) conditions.push(eq(campaignSummaries.status, status));
    if (search)
      conditions.push(sql`${campaignSummaries.name} ILIKE ${`%${search}%`}`);

    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(campaignSummaries)
        .where(where)
        .orderBy(desc(campaignSummaries.updatedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaignSummaries)
        .where(where),
    ]);

    return {
      data: rows.map((row) => this.mapSummaryToEntity(row)),
      total: countResult[0]?.count ?? 0,
    };
  }

  async save(campaign: Campaign): Promise<void> {
    const props = campaign.toProps();
    const summaryProps = this.mapEntityToSummaryProps(props);

    await this.db
      .insert(campaigns)
      .values({
        ...props,
        // Drizzle handles Date objects correctly usually, but we ensure primitives match schema
      })
      .onConflictDoUpdate({
        target: campaigns.id,
        set: {
          ...props,
          updatedAt: new Date(),
        },
      });

    await this.db
      .insert(campaignSummaries)
      .values(summaryProps)
      .onConflictDoUpdate({
        target: campaignSummaries.campaignId,
        set: {
          ...summaryProps,
          updatedAt: new Date(),
        },
      });
  }

  async delete(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, orgId)));
  }

  // Private helper to reconstite entity
  private mapToEntity(row: typeof campaigns.$inferSelect): Campaign {
    return Campaign.reconstitute({
      minScore: null,
      maxScore: null,
      grades: null,
      ...row,
      type: row.type as any,
      status: row.status as any,
    });
  }

  private mapSummaryToEntity(
    row: typeof campaignSummaries.$inferSelect,
  ): Campaign {
    return Campaign.reconstitute({
      id: row.campaignId,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description ?? null,
      type: row.type as any,
      status: row.status as any,
      subject: row.subject ?? null,
      templateId: row.templateId ?? null,
      segmentId: row.segmentId ?? null,
      minScore: null,
      maxScore: null,
      grades: null,
      scheduledAt: row.scheduledAt ?? null,
      startedAt: row.startedAt ?? null,
      completedAt: row.completedAt ?? null,
      recipientCount: row.recipientCount,
      sentCount: row.sentCount,
      failedCount: row.failedCount,
      deliveredCount: row.deliveredCount,
      openCount: row.openCount,
      clickCount: row.clickCount,
      bounceCount: row.bounceCount,
      complaintCount: row.complaintCount,
      unsubscribeCount: row.unsubscribeCount,
      openRate: row.openRate,
      clickRate: row.clickRate,
      lastEventAt: row.lastEventAt ?? null,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private mapEntityToSummaryProps(props: CampaignProps) {
    return {
      campaignId: props.id,
      organizationId: props.organizationId,
      name: props.name,
      description: props.description,
      type: props.type,
      status: props.status,
      subject: props.subject,
      templateId: props.templateId,
      segmentId: props.segmentId,
      createdBy: props.createdBy,
      scheduledAt: props.scheduledAt,
      startedAt: props.startedAt,
      completedAt: props.completedAt,
      recipientCount: props.recipientCount,
      sentCount: props.sentCount,
      failedCount: props.failedCount,
      deliveredCount: props.deliveredCount,
      openCount: props.openCount,
      clickCount: props.clickCount,
      bounceCount: props.bounceCount,
      complaintCount: props.complaintCount,
      unsubscribeCount: props.unsubscribeCount,
      openRate: props.openRate,
      clickRate: props.clickRate,
      lastEventAt: props.lastEventAt,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
    };
  }
}

// Keep stats functions for now as they are not part of the main repository interface yet
// but are used by routes. We might move them later.
export type CampaignStatsRow = typeof campaignStats.$inferSelect;

export async function findCampaignStats(
  db: NeonHttpDatabase,
  orgId: string,
  campaignId: string,
): Promise<CampaignStatsRow | null> {
  const [stats] = await db
    .select()
    .from(campaignStats)
    .where(
      and(
        eq(campaignStats.campaignId, campaignId),
        eq(campaignStats.organizationId, orgId),
      ),
    );
  return stats ?? null;
}
