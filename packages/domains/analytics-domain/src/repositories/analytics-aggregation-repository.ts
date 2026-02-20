import {
  campaignDailyStats,
  contactActivity,
  dailyScoreDistribution,
  enrichmentMetrics,
  eventAggregates,
} from '@mauntic/analytics-domain/drizzle';
import { sending_domains } from '@mauntic/delivery-domain/drizzle';
import { enrichmentJobs } from '@mauntic/lead-intelligence-domain/drizzle';
import { leadScores } from '@mauntic/scoring-domain/drizzle';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type {
  AnalyticsAggregationRepository,
  DailyReportResult,
  HourlyAggregationResult,
} from '../services/analytics-aggregation-service.js';

export interface WarmupCounterStore {
  resetDailyCounter(organizationId: string, domain: string): Promise<void>;
}

export class DrizzleAnalyticsRepository
  implements AnalyticsAggregationRepository
{
  constructor(
    private readonly db: NeonHttpDatabase<Record<string, unknown>> | any,
    private readonly warmupStore?: WarmupCounterStore,
  ) {}

  async aggregateHourlyEvents(since: Date): Promise<HourlyAggregationResult> {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const rawEvents = await this.db
      .select({
        organizationId: contactActivity.organizationId,
        eventType: contactActivity.eventType,
        count: sql<number>`count(*)::int`,
        uniqueCount: sql<number>`count(distinct ${contactActivity.contactId})::int`,
      })
      .from(contactActivity)
      .where(gte(contactActivity.createdAt, since))
      .groupBy(contactActivity.organizationId, contactActivity.eventType);

    for (const row of rawEvents) {
      const [existing] = await this.db
        .select()
        .from(eventAggregates)
        .where(
          and(
            eq(eventAggregates.organizationId, row.organizationId),
            eq(eventAggregates.eventType, row.eventType),
            eq(eventAggregates.date, todayStr),
          ),
        )
        .limit(1);

      if (existing) {
        await this.db
          .update(eventAggregates)
          .set({
            count: sql`${eventAggregates.count} + ${row.count}`,
            uniqueCount: sql`${eventAggregates.uniqueCount} + ${row.uniqueCount}`,
          })
          .where(eq(eventAggregates.id, existing.id));
      } else {
        await this.db.insert(eventAggregates).values({
          organizationId: row.organizationId,
          date: todayStr,
          eventType: row.eventType,
          count: row.count,
          uniqueCount: row.uniqueCount,
        });
      }
    }

    return { aggregatedGroups: rawEvents.length, timestamp: now };
  }

  async generateDailyCampaignStats(day: Date): Promise<DailyReportResult> {
    const now = new Date();
    const yesterdayStr = day.toISOString().split('T')[0];

    const campaignEvents = await this.db
      .select({
        organizationId: contactActivity.organizationId,
        eventSource: contactActivity.eventSource,
        eventType: contactActivity.eventType,
        count: sql<number>`count(*)::int`,
        uniqueCount: sql<number>`count(distinct ${contactActivity.contactId})::int`,
      })
      .from(contactActivity)
      .where(
        and(
          gte(contactActivity.createdAt, day),
          lte(contactActivity.createdAt, now),
          sql`${contactActivity.eventSource} IS NOT NULL`,
        ),
      )
      .groupBy(
        contactActivity.organizationId,
        contactActivity.eventSource,
        contactActivity.eventType,
      );

    const campaignMap = new Map<
      string,
      {
        orgId: string;
        campaignId: string;
        metrics: Record<string, { count: number; uniqueCount: number }>;
      }
    >();

    for (const row of campaignEvents) {
      if (!row.eventSource) continue;
      const key = `${row.organizationId}:${row.eventSource}`;
      if (!campaignMap.has(key)) {
        campaignMap.set(key, {
          orgId: row.organizationId,
          campaignId: row.eventSource,
          metrics: {},
        });
      }
      const entry = campaignMap.get(key)!;
      entry.metrics[row.eventType] = {
        count: row.count,
        uniqueCount: row.uniqueCount,
      };
    }

    for (const [, { orgId, campaignId, metrics }] of campaignMap) {
      const getMetric = (type: string) =>
        metrics[type] ?? { count: 0, uniqueCount: 0 };

      await this.db.insert(campaignDailyStats).values({
        campaignId,
        organizationId: orgId,
        date: yesterdayStr,
        sent: getMetric('email_sent').count,
        delivered: getMetric('email_delivered').count,
        opened: getMetric('email_opened').count,
        uniqueOpened: getMetric('email_opened').uniqueCount,
        clicked: getMetric('email_clicked').count,
        uniqueClicked: getMetric('email_clicked').uniqueCount,
        bounced: getMetric('email_bounced').count,
        complained: getMetric('email_complained').count,
        unsubscribed: getMetric('email_unsubscribed').count,
      });
    }

    return { campaignsProcessed: campaignMap.size, date: yesterdayStr };
  }

  async generateMonthlyUsage(month: Date): Promise<number> {
    const nextMonth = new Date(month);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const monthlyCounts = await this.db
      .select({
        organizationId: contactActivity.organizationId,
        eventType: contactActivity.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(contactActivity)
      .where(
        and(
          gte(contactActivity.createdAt, month),
          lte(contactActivity.createdAt, nextMonth),
        ),
      )
      .groupBy(contactActivity.organizationId, contactActivity.eventType);

    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
    for (const row of monthlyCounts) {
      await this.db.insert(eventAggregates).values({
        organizationId: row.organizationId,
        date: monthStr,
        eventType: `monthly:${row.eventType}`,
        count: row.count,
        uniqueCount: 0,
        channel: 'monthly_summary',
      });
    }
    return monthlyCounts.length;
  }

  async generateScoreDistribution(date: string): Promise<number> {
    const distributions = await this.db
      .select({
        organizationId: leadScores.organization_id,
        avgScore: sql<string>`avg(${leadScores.total_score})::numeric(5,2)`,
        minScore: sql<number>`min(${leadScores.total_score})`,
        maxScore: sql<number>`max(${leadScores.total_score})`,
        p50: sql<number>`percentile_cont(0.5) within group (order by ${leadScores.total_score})`,
        p90: sql<number>`percentile_cont(0.9) within group (order by ${leadScores.total_score})`,
        p95: sql<number>`percentile_cont(0.95) within group (order by ${leadScores.total_score})`,
        totalContacts: sql<number>`count(*)::int`,
      })
      .from(leadScores)
      .groupBy(leadScores.organization_id);

    for (const dist of distributions) {
      await this.db.insert(dailyScoreDistribution).values({
        organizationId: dist.organizationId,
        date,
        avgScore: dist.avgScore,
        minScore: dist.minScore,
        maxScore: dist.maxScore,
        p50: dist.p50,
        p90: dist.p90,
        p95: dist.p95,
        totalContacts: dist.totalContacts,
      });
    }

    return distributions.length;
  }

  async generateEnrichmentMetrics(date: string): Promise<number> {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const metrics = await this.db
      .select({
        organizationId: enrichmentJobs.organization_id,
        totalEnriched: sql<number>`count(*)::int`,
        successRate: sql<string>`(count(*) filter (where ${enrichmentJobs.status} = 'completed')::numeric / nullif(count(*), 0) * 100)::numeric(5,2)`,
      })
      .from(enrichmentJobs)
      .where(
        and(
          gte(enrichmentJobs.created_at, yesterday),
          lte(enrichmentJobs.created_at, now),
        ),
      )
      .groupBy(enrichmentJobs.organization_id);

    for (const metric of metrics) {
      await this.db.insert(enrichmentMetrics).values({
        organizationId: metric.organizationId,
        date,
        totalEnriched: metric.totalEnriched,
        successRate: metric.successRate ?? '0',
        avgCost: '0',
        avgFreshness: '0',
      });
    }
    return metrics.length;
  }

  async resetDailyWarmup(): Promise<number> {
    if (!this.warmupStore) {
      return 0;
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const domains = await this.db
      .select({
        organizationId: sending_domains.organization_id,
        domain: sending_domains.domain,
      })
      .from(sending_domains)
      .where(
        and(
          eq(sending_domains.status, 'verified'),
          gte(sending_domains.created_at, thirtyDaysAgo),
        ),
      )
      .orderBy(desc(sending_domains.created_at));

    let resetCount = 0;
    for (const domain of domains) {
      await this.warmupStore.resetDailyCounter(
        String(domain.organizationId),
        String(domain.domain),
      );
      resetCount++;
    }
    return resetCount;
  }
}
