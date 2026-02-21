import type {
  ReportDataSource,
  ReportDateRange,
  ReportResult,
} from '@mauntic/analytics-domain';
import {
  campaignDailyStats,
  contactActivity,
  eventAggregates,
} from '@mauntic/analytics-domain/drizzle';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';

export class DrizzleReportDataSource implements ReportDataSource {
  constructor(private readonly db: NeonHttpDatabase) {}

  async getContactGrowth(
    orgId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${contactActivity.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(distinct ${contactActivity.contactId})::int`,
      })
      .from(contactActivity)
      .where(
        and(
          eq(contactActivity.organizationId, orgId),
          gte(contactActivity.createdAt, range.startDate),
          lte(contactActivity.createdAt, range.endDate),
        ),
      )
      .groupBy(sql`date_trunc('day', ${contactActivity.createdAt})`)
      .orderBy(sql`date_trunc('day', ${contactActivity.createdAt})`);

    const labels = rows.map((row) => row.date);
    const dailyGrowth = rows.map((row) => row.count);
    const cumulativeGrowth: number[] = [];
    for (const value of dailyGrowth) {
      cumulativeGrowth.push(
        value + (cumulativeGrowth[cumulativeGrowth.length - 1] ?? 0),
      );
    }

    return {
      labels,
      datasets: [
        { label: 'New Contacts', data: dailyGrowth },
        { label: 'Cumulative Contacts', data: cumulativeGrowth },
      ],
      summary: {
        totalNewContacts: dailyGrowth.reduce((sum, value) => sum + value, 0),
        finalCumulativeContacts:
          cumulativeGrowth[cumulativeGrowth.length - 1] ?? 0,
      },
    };
  }

  async getEmailPerformance(
    orgId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    const rows = await this.db
      .select({
        date: eventAggregates.date,
        eventType: eventAggregates.eventType,
        count: eventAggregates.count,
      })
      .from(eventAggregates)
      .where(
        and(
          eq(eventAggregates.organizationId, orgId),
          gte(eventAggregates.date, toIsoDate(range.startDate)),
          lte(eventAggregates.date, toIsoDate(range.endDate)),
          inArray(eventAggregates.eventType, [
            'email_sent',
            'email_delivered',
            'email_opened',
            'email_clicked',
          ]),
        ),
      )
      .orderBy(desc(eventAggregates.date));

    const byDate = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const key = row.date;
      const bucket = byDate.get(key) ?? {};
      bucket[row.eventType] = Number(row.count ?? 0);
      byDate.set(key, bucket);
    }

    const labels = [...byDate.keys()].sort();
    const sentSeries: number[] = [];
    const openRateSeries: number[] = [];
    const clickRateSeries: number[] = [];

    for (const day of labels) {
      const bucket = byDate.get(day) ?? {};
      const sent = bucket.email_sent ?? 0;
      const opened = bucket.email_opened ?? 0;
      const clicked = bucket.email_clicked ?? 0;
      sentSeries.push(sent);
      openRateSeries.push(sent > 0 ? roundPercent((opened / sent) * 100) : 0);
      clickRateSeries.push(sent > 0 ? roundPercent((clicked / sent) * 100) : 0);
    }

    return {
      labels,
      datasets: [
        { label: 'Emails Sent', data: sentSeries },
        { label: 'Open Rate (%)', data: openRateSeries },
        { label: 'Click Rate (%)', data: clickRateSeries },
      ],
      summary: {
        totalEmailsSent: sentSeries.reduce((sum, value) => sum + value, 0),
        avgOpenRate:
          openRateSeries.length > 0
            ? roundPercent(
                openRateSeries.reduce((sum, value) => sum + value, 0) /
                  openRateSeries.length,
              )
            : 0,
        avgClickRate:
          clickRateSeries.length > 0
            ? roundPercent(
                clickRateSeries.reduce((sum, value) => sum + value, 0) /
                  clickRateSeries.length,
              )
            : 0,
      },
    };
  }

  async getCampaignComparison(
    orgId: string,
    range: ReportDateRange,
    campaignIds?: string[],
  ): Promise<ReportResult> {
    const conditions = [
      eq(campaignDailyStats.organizationId, orgId),
      gte(campaignDailyStats.date, toIsoDate(range.startDate)),
      lte(campaignDailyStats.date, toIsoDate(range.endDate)),
    ];
    if (Array.isArray(campaignIds) && campaignIds.length > 0) {
      conditions.push(inArray(campaignDailyStats.campaignId, campaignIds));
    }

    const rows = await this.db
      .select({
        campaignId: campaignDailyStats.campaignId,
        sent: campaignDailyStats.sent,
        uniqueOpened: campaignDailyStats.uniqueOpened,
        uniqueClicked: campaignDailyStats.uniqueClicked,
      })
      .from(campaignDailyStats)
      .where(and(...conditions));

    const byCampaign = new Map<
      string,
      { sent: number; uniqueOpened: number; uniqueClicked: number }
    >();
    for (const row of rows) {
      const bucket = byCampaign.get(row.campaignId) ?? {
        sent: 0,
        uniqueOpened: 0,
        uniqueClicked: 0,
      };
      bucket.sent += Number(row.sent ?? 0);
      bucket.uniqueOpened += Number(row.uniqueOpened ?? 0);
      bucket.uniqueClicked += Number(row.uniqueClicked ?? 0);
      byCampaign.set(row.campaignId, bucket);
    }

    const labels = [...byCampaign.keys()].sort();
    const sentSeries: number[] = [];
    const openRateSeries: number[] = [];
    const clickRateSeries: number[] = [];

    for (const campaignId of labels) {
      const bucket = byCampaign.get(campaignId) ?? {
        sent: 0,
        uniqueOpened: 0,
        uniqueClicked: 0,
      };
      sentSeries.push(bucket.sent);
      openRateSeries.push(
        bucket.sent > 0
          ? roundPercent((bucket.uniqueOpened / bucket.sent) * 100)
          : 0,
      );
      clickRateSeries.push(
        bucket.sent > 0
          ? roundPercent((bucket.uniqueClicked / bucket.sent) * 100)
          : 0,
      );
    }

    return {
      labels,
      datasets: [
        { label: 'Recipients', data: sentSeries },
        { label: 'Open Rate (%)', data: openRateSeries },
        { label: 'Click Rate (%)', data: clickRateSeries },
      ],
      summary: {
        campaignCount: labels.length,
        totalRecipients: sentSeries.reduce((sum, value) => sum + value, 0),
      },
    };
  }

  async getRevenue(
    orgId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${contactActivity.createdAt}), 'YYYY-MM-DD')`,
        eventData: contactActivity.eventData,
      })
      .from(contactActivity)
      .where(
        and(
          eq(contactActivity.organizationId, orgId),
          inArray(contactActivity.eventType, ['deal_won', 'revenue']),
          gte(contactActivity.createdAt, range.startDate),
          lte(contactActivity.createdAt, range.endDate),
        ),
      )
      .orderBy(sql`date_trunc('day', ${contactActivity.createdAt})`);

    const byDate = new Map<string, number>();
    for (const row of rows) {
      const amount = readNumericAmount(row.eventData);
      byDate.set(row.date, (byDate.get(row.date) ?? 0) + amount);
    }

    const labels = [...byDate.keys()].sort();
    const revenueSeries = labels.map((date) =>
      roundMoney(byDate.get(date) ?? 0),
    );
    const totalRevenue = roundMoney(
      revenueSeries.reduce((sum, value) => sum + value, 0),
    );

    return {
      labels,
      datasets: [{ label: 'Revenue', data: revenueSeries }],
      summary: {
        totalRevenue,
        avgDailyRevenue:
          revenueSeries.length > 0
            ? roundMoney(totalRevenue / revenueSeries.length)
            : 0,
      },
    };
  }
}

function readNumericAmount(eventData: unknown): number {
  if (!eventData || typeof eventData !== 'object') return 0;
  const value = (eventData as Record<string, unknown>).amount;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function toIsoDate(value: Date): string {
  return value.toISOString().split('T')[0] ?? '';
}

function roundPercent(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
