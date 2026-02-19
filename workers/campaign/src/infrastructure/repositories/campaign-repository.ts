import { eq, and, desc, sql } from 'drizzle-orm';
import { campaigns, campaignStats } from '@mauntic/campaign-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Campaign, type CampaignRepository, type CampaignProps } from '@mauntic/campaign-domain';

export class DrizzleCampaignRepository implements CampaignRepository {
  constructor(private readonly db: NeonHttpDatabase) { }

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
    pagination: { page: number; limit: number; status?: string; search?: string },
  ): Promise<{ data: Campaign[]; total: number }> {
    const { page, limit, status, search } = pagination;
    const offset = (page - 1) * limit;

    const conditions = [eq(campaigns.organizationId, orgId)];
    if (status) conditions.push(eq(campaigns.status, status));
    if (search) conditions.push(sql`${campaigns.name} ILIKE ${'%' + search + '%'}`);

    const where = and(...conditions);

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(campaigns)
        .where(where)
        .orderBy(desc(campaigns.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaigns)
        .where(where),
    ]);

    return {
      data: rows.map((row) => this.mapToEntity(row)),
      total: countResult[0]?.count ?? 0,
    };
  }

  async save(campaign: Campaign): Promise<void> {
    const props = campaign.toProps();
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
  }

  async delete(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, orgId)));
  }

  // Private helper to reconstite entity
  private mapToEntity(row: typeof campaigns.$inferSelect): Campaign {
    return Campaign.reconstitute({
      ...row,
      type: row.type as any,
      status: row.status as any,
    });
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
