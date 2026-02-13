import { eq, and, desc, sql } from 'drizzle-orm';
import { campaigns, campaignStats } from '@mauntic/campaign-domain/drizzle';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export type CampaignRow = typeof campaigns.$inferSelect;
export type CampaignInsert = typeof campaigns.$inferInsert;
export type CampaignStatsRow = typeof campaignStats.$inferSelect;

export async function findCampaignById(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<CampaignRow | null> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, orgId)));
  return campaign ?? null;
}

export async function findCampaignsByOrganization(
  db: NeonHttpDatabase,
  orgId: string,
  opts: { page: number; limit: number; status?: string; search?: string },
): Promise<{ data: CampaignRow[]; total: number }> {
  const { page, limit, status, search } = opts;
  const offset = (page - 1) * limit;

  const conditions = [eq(campaigns.organizationId, orgId)];
  if (status) conditions.push(eq(campaigns.status, status));
  if (search) conditions.push(sql`${campaigns.name} ILIKE ${'%' + search + '%'}`);

  const where = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(campaigns)
      .where(where)
      .orderBy(desc(campaigns.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(campaigns)
      .where(where),
  ]);

  return { data, total: countResult[0]?.count ?? 0 };
}

export async function createCampaign(
  db: NeonHttpDatabase,
  data: CampaignInsert,
): Promise<CampaignRow> {
  const [campaign] = await db.insert(campaigns).values(data).returning();
  return campaign;
}

export async function updateCampaign(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
  data: Partial<Omit<CampaignInsert, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>>,
): Promise<CampaignRow | null> {
  const [campaign] = await db
    .update(campaigns)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, orgId)))
    .returning();
  return campaign ?? null;
}

export async function deleteCampaign(
  db: NeonHttpDatabase,
  orgId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, orgId)))
    .returning({ id: campaigns.id });
  return result.length > 0;
}

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

export async function upsertCampaignStats(
  db: NeonHttpDatabase,
  orgId: string,
  campaignId: string,
  data: Partial<Pick<typeof campaignStats.$inferInsert, 'totalRecipients' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed'>>,
): Promise<CampaignStatsRow> {
  const existing = await findCampaignStats(db, orgId, campaignId);

  if (existing) {
    const [updated] = await db
      .update(campaignStats)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(campaignStats.campaignId, campaignId),
          eq(campaignStats.organizationId, orgId),
        ),
      )
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(campaignStats)
    .values({
      campaignId,
      organizationId: orgId,
      totalRecipients: 0,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      complained: 0,
      unsubscribed: 0,
      ...data,
    })
    .returning();
  return created;
}
