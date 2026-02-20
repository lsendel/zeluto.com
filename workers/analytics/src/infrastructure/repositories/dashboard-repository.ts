import {
  campaignDailyStats,
  contactActivity,
  eventAggregates,
  journeyDailyStats,
} from '@mauntic/analytics-domain/drizzle';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export async function getOverviewStats(db: NeonHttpDatabase, orgId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  // Get today's aggregate counts
  const aggregates = await db
    .select()
    .from(eventAggregates)
    .where(
      and(
        eq(eventAggregates.organizationId, orgId),
        eq(eventAggregates.date, todayStr),
      ),
    );

  // Get recent activity
  const recentActivity = await db
    .select()
    .from(contactActivity)
    .where(eq(contactActivity.organizationId, orgId))
    .orderBy(desc(contactActivity.createdAt))
    .limit(10);

  return { aggregates, recentActivity };
}

export async function getOverviewKpis(db: NeonHttpDatabase, orgId: string) {
  const [totalContactsResult, activeJourneysResult, campaignsSentResult] =
    await Promise.all([
      db
        .select({
          count: sql<number>`count(distinct ${contactActivity.contactId})::int`,
        })
        .from(contactActivity)
        .where(eq(contactActivity.organizationId, orgId)),
      db
        .select({
          count: sql<number>`count(distinct ${journeyDailyStats.journeyId})::int`,
        })
        .from(journeyDailyStats)
        .where(
          and(
            eq(journeyDailyStats.organizationId, orgId),
            gt(journeyDailyStats.active, 0),
          ),
        ),
      db
        .select({
          count: sql<number>`count(distinct ${campaignDailyStats.campaignId})::int`,
        })
        .from(campaignDailyStats)
        .where(
          and(
            eq(campaignDailyStats.organizationId, orgId),
            gt(campaignDailyStats.sent, 0),
          ),
        ),
    ]);

  return {
    totalContacts: totalContactsResult[0]?.count ?? 0,
    activeJourneys: activeJourneysResult[0]?.count ?? 0,
    campaignsSent: campaignsSentResult[0]?.count ?? 0,
  };
}

export async function getCampaignStats(
  db: NeonHttpDatabase,
  orgId: string,
  campaignId: string,
  _opts?: { startDate?: string; endDate?: string },
) {
  const conditions = [
    eq(campaignDailyStats.organizationId, orgId),
    eq(campaignDailyStats.campaignId, campaignId),
  ];

  return db
    .select()
    .from(campaignDailyStats)
    .where(and(...conditions))
    .orderBy(desc(campaignDailyStats.date));
}

export async function getJourneyStats(
  db: NeonHttpDatabase,
  orgId: string,
  journeyId: string,
) {
  return db
    .select()
    .from(journeyDailyStats)
    .where(
      and(
        eq(journeyDailyStats.organizationId, orgId),
        eq(journeyDailyStats.journeyId, journeyId),
      ),
    )
    .orderBy(desc(journeyDailyStats.date));
}
