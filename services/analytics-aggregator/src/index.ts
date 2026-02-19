import { startHealthServer, createWorker, registerScheduledJobs, getRedis, getDb, type JobHandler } from '@mauntic/process-lib';
import type { Job } from 'bullmq';
import pino from 'pino';
import { eq, and, sql, gte, lte, desc } from 'drizzle-orm';
import {
  contactActivity,
  eventAggregates,
  campaignDailyStats,
  journeyDailyStats,
  dailyScoreDistribution,
  enrichmentMetrics,
} from '@mauntic/analytics-domain/drizzle';

const logger = pino({ name: 'analytics-aggregator' });

// ---------------------------------------------------------------------------
// Hourly: Event aggregation
// ---------------------------------------------------------------------------

const hourlyAggregationHandler: JobHandler = {
  name: 'analytics:aggregate-hourly',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting hourly analytics aggregation...');

    const db = getDb();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];

    try {
      // Query raw events from the last hour grouped by org + event type
      const rawEvents = await db
        .select({
          organizationId: contactActivity.organizationId,
          eventType: contactActivity.eventType,
          count: sql<number>`count(*)::int`,
          uniqueCount: sql<number>`count(distinct ${contactActivity.contactId})::int`,
        })
        .from(contactActivity)
        .where(gte(contactActivity.createdAt, oneHourAgo))
        .groupBy(contactActivity.organizationId, contactActivity.eventType);

      // Upsert into event_aggregates
      for (const row of rawEvents) {
        // Try to update existing row for today
        const [existing] = await db
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
          await db
            .update(eventAggregates)
            .set({
              count: sql`${eventAggregates.count} + ${row.count}`,
              uniqueCount: sql`${eventAggregates.uniqueCount} + ${row.uniqueCount}`,
            })
            .where(eq(eventAggregates.id, existing.id));
        } else {
          await db.insert(eventAggregates).values({
            organizationId: row.organizationId,
            date: todayStr,
            eventType: row.eventType,
            count: row.count,
            uniqueCount: row.uniqueCount,
          });
        }
      }

      logger.info(
        { aggregatedGroups: rawEvents.length, date: todayStr },
        'Hourly aggregation completed',
      );

      return { success: true, aggregatedAt: now.toISOString(), groups: rawEvents.length };
    } catch (error) {
      logger.error({ error }, 'Hourly aggregation failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Daily: Report generation (campaign + journey daily stats rollup)
// ---------------------------------------------------------------------------

const dailyReportHandler: JobHandler = {
  name: 'analytics:generate-daily-reports',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting daily report generation...');

    const db = getDb();
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      // Aggregate campaign events from yesterday into campaign_daily_stats
      const campaignEvents = await db
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
            gte(contactActivity.createdAt, yesterday),
            lte(contactActivity.createdAt, now),
            sql`${contactActivity.eventSource} IS NOT NULL`,
          ),
        )
        .groupBy(
          contactActivity.organizationId,
          contactActivity.eventSource,
          contactActivity.eventType,
        );

      // Group campaign events by campaignId
      const campaignMap = new Map<string, {
        orgId: string;
        campaignId: string;
        metrics: Record<string, { count: number; uniqueCount: number }>;
      }>();
      for (const row of campaignEvents) {
        if (!row.eventSource) continue;
        const key = `${row.organizationId}:${row.eventSource}`;
        if (!campaignMap.has(key)) {
          campaignMap.set(key, { orgId: row.organizationId, campaignId: row.eventSource, metrics: {} });
        }
        const entry = campaignMap.get(key)!;
        entry.metrics[row.eventType] = { count: row.count, uniqueCount: row.uniqueCount };
      }

      // Insert campaign daily stats
      for (const [, { orgId, campaignId, metrics }] of campaignMap) {
        const get = (type: string) => metrics[type] ?? { count: 0, uniqueCount: 0 };

        await db.insert(campaignDailyStats).values({
          campaignId,
          organizationId: orgId,
          date: yesterdayStr,
          sent: get('email_sent').count,
          delivered: get('email_delivered').count,
          opened: get('email_opened').count,
          uniqueOpened: get('email_opened').uniqueCount,
          clicked: get('email_clicked').count,
          uniqueClicked: get('email_clicked').uniqueCount,
          bounced: get('email_bounced').count,
          complained: get('email_complained').count,
          unsubscribed: get('email_unsubscribed').count,
        });
      }

      logger.info(
        { date: yesterdayStr, campaigns: campaignMap.size },
        'Daily report generation completed',
      );

      return { success: true, date: yesterdayStr, campaigns: campaignMap.size };
    } catch (error) {
      logger.error({ error }, 'Daily report generation failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Monthly: Usage summary per organization
// ---------------------------------------------------------------------------

const monthlyUsageHandler: JobHandler = {
  name: 'analytics:monthly-usage-summary',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting monthly usage summary...');

    const db = getDb();
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(firstOfMonth);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    try {
      // Count events per org for last month
      const monthlyCounts = await db
        .select({
          organizationId: contactActivity.organizationId,
          eventType: contactActivity.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(contactActivity)
        .where(
          and(
            gte(contactActivity.createdAt, lastMonth),
            lte(contactActivity.createdAt, firstOfMonth),
          ),
        )
        .groupBy(contactActivity.organizationId, contactActivity.eventType);

      // Store as monthly aggregates in event_aggregates
      const monthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}-01`;
      for (const row of monthlyCounts) {
        await db.insert(eventAggregates).values({
          organizationId: row.organizationId,
          date: monthStr,
          eventType: `monthly:${row.eventType}`,
          count: row.count,
          uniqueCount: 0,
          channel: 'monthly_summary',
        });
      }

      logger.info(
        { month: monthStr, orgs: new Set(monthlyCounts.map((r) => r.organizationId)).size },
        'Monthly usage summary completed',
      );

      return { success: true, month: monthStr, rows: monthlyCounts.length };
    } catch (error) {
      logger.error({ error }, 'Monthly usage summary failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Daily: Warmup daily send counter reset
// ---------------------------------------------------------------------------

const warmupResetHandler: JobHandler = {
  name: 'analytics:warmup-daily-reset',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting warmup daily send counter reset...');

    const db = getDb();
    const redis = getRedis();

    try {
      // Find all sending domains that are in warmup period (created < 30 days ago)
      const { sending_domains } = await import('@mauntic/delivery-domain/drizzle');
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const domains = await db
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
        );

      // Reset daily send counters in Redis for each org+domain
      let resetCount = 0;
      for (const domain of domains) {
        const key = `warmup:daily:${domain.organizationId}:${domain.domain}`;
        await redis.del(key);
        resetCount++;
      }

      logger.info(
        { resetCount, domains: domains.length },
        'Warmup daily send counter reset completed',
      );

      return { success: true, resetCount };
    } catch (error) {
      logger.error({ error }, 'Warmup daily reset failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Daily: Score distribution aggregation
// ---------------------------------------------------------------------------

const scoreDistributionHandler: JobHandler = {
  name: 'analytics:score-distribution',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting daily score distribution aggregation...');

    const db = getDb();
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const { lead_scores } = await import('@mauntic/scoring-domain/drizzle');

      // Aggregate score distribution per organization
      const distributions = await db
        .select({
          organizationId: lead_scores.organization_id,
          avgScore: sql<string>`avg(${lead_scores.total_score})::numeric(5,2)`,
          minScore: sql<number>`min(${lead_scores.total_score})`,
          maxScore: sql<number>`max(${lead_scores.total_score})`,
          p50: sql<number>`percentile_cont(0.5) within group (order by ${lead_scores.total_score})`,
          p90: sql<number>`percentile_cont(0.9) within group (order by ${lead_scores.total_score})`,
          p95: sql<number>`percentile_cont(0.95) within group (order by ${lead_scores.total_score})`,
          totalContacts: sql<number>`count(*)::int`,
        })
        .from(lead_scores)
        .groupBy(lead_scores.organization_id);

      for (const dist of distributions) {
        await db.insert(dailyScoreDistribution).values({
          organizationId: dist.organizationId,
          date: todayStr,
          avgScore: dist.avgScore,
          minScore: dist.minScore,
          maxScore: dist.maxScore,
          p50: dist.p50,
          p90: dist.p90,
          p95: dist.p95,
          totalContacts: dist.totalContacts,
        });
      }

      logger.info({ date: todayStr, orgs: distributions.length }, 'Score distribution aggregation completed');
      return { success: true, date: todayStr, orgs: distributions.length };
    } catch (error) {
      logger.error({ error }, 'Score distribution aggregation failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Daily: Enrichment metrics aggregation
// ---------------------------------------------------------------------------

const enrichmentMetricsHandler: JobHandler = {
  name: 'analytics:enrichment-metrics',
  concurrency: 1,
  async process(job: Job) {
    logger.info('Starting daily enrichment metrics aggregation...');

    const db = getDb();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    try {
      const { enrichment_jobs } = await import('@mauntic/lead-intelligence-domain/drizzle');

      const metrics = await db
        .select({
          organizationId: enrichment_jobs.organization_id,
          totalEnriched: sql<number>`count(*)::int`,
          successRate: sql<string>`(count(*) filter (where ${enrichment_jobs.status} = 'completed')::numeric / nullif(count(*), 0) * 100)::numeric(5,2)`,
        })
        .from(enrichment_jobs)
        .where(
          and(
            gte(enrichment_jobs.created_at, yesterday),
            lte(enrichment_jobs.created_at, new Date()),
          ),
        )
        .groupBy(enrichment_jobs.organization_id);

      for (const m of metrics) {
        await db.insert(enrichmentMetrics).values({
          organizationId: m.organizationId,
          date: yesterdayStr,
          totalEnriched: m.totalEnriched,
          successRate: m.successRate ?? '0',
          avgCost: '0',
          avgFreshness: '0',
        });
      }

      logger.info({ date: yesterdayStr, orgs: metrics.length }, 'Enrichment metrics aggregation completed');
      return { success: true, date: yesterdayStr, orgs: metrics.length };
    } catch (error) {
      logger.error({ error }, 'Enrichment metrics aggregation failed');
      throw error;
    }
  },
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

async function main() {
  const port = parseInt(process.env.PORT || '8080', 10);
  const server = startHealthServer(port);
  logger.info({ port }, 'Health server started');

  // Register scheduled jobs
  await registerScheduledJobs('analytics:aggregate-hourly', [
    { name: 'hourly-event-aggregation', pattern: '0 * * * *' }, // Every hour
  ]);
  await registerScheduledJobs('analytics:generate-daily-reports', [
    { name: 'daily-report-generation', pattern: '0 2 * * *' }, // Daily at 2am
  ]);
  await registerScheduledJobs('analytics:monthly-usage-summary', [
    { name: 'monthly-usage-summary', pattern: '0 3 1 * *' }, // 1st of each month at 3am
  ]);
  await registerScheduledJobs('analytics:warmup-daily-reset', [
    { name: 'warmup-daily-reset', pattern: '0 0 * * *' }, // Daily at midnight
  ]);
  await registerScheduledJobs('analytics:score-distribution', [
    { name: 'daily-score-distribution', pattern: '0 4 * * *' }, // Daily at 4am
  ]);
  await registerScheduledJobs('analytics:enrichment-metrics', [
    { name: 'daily-enrichment-metrics', pattern: '0 5 * * *' }, // Daily at 5am
  ]);

  // Workers process the scheduled jobs
  const hourlyWorker = createWorker('analytics:aggregate-hourly', hourlyAggregationHandler);
  const dailyWorker = createWorker('analytics:generate-daily-reports', dailyReportHandler);
  const monthlyWorker = createWorker('analytics:monthly-usage-summary', monthlyUsageHandler);
  const warmupResetWorker = createWorker('analytics:warmup-daily-reset', warmupResetHandler);
  const scoreDistWorker = createWorker('analytics:score-distribution', scoreDistributionHandler);
  const enrichmentMetricsWorker = createWorker('analytics:enrichment-metrics', enrichmentMetricsHandler);

  const allWorkers = [hourlyWorker, dailyWorker, monthlyWorker, warmupResetWorker, scoreDistWorker, enrichmentMetricsWorker];

  allWorkers.forEach((worker) => {
    worker.on('completed', (job) => {
      logger.info({ jobId: job.id, queue: worker.name }, 'Job completed');
    });
    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, queue: worker.name, error: err }, 'Job failed');
    });
  });

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await Promise.all(allWorkers.map((w) => w.close()));
    const redis = getRedis();
    await redis.quit();
    server.close();
    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  logger.info('Analytics aggregator service started');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error');
  process.exit(1);
});
