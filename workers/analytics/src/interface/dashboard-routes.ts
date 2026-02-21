import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  getCampaignStats,
  getJourneyStats,
  getOverviewKpis,
  getOverviewStats,
} from '../infrastructure/repositories/dashboard-repository.js';

export const dashboardRoutes = new Hono<Env>();

// GET /api/v1/analytics/overview - Dashboard overview stats
dashboardRoutes.get('/api/v1/analytics/overview', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const [stats, kpis] = await Promise.all([
      getOverviewStats(db, tenant.organizationId),
      getOverviewKpis(db, tenant.organizationId),
    ]);

    // Compute summary from aggregates
    let emailsSentToday = 0;
    let totalOpened = 0;
    let totalClicked = 0;
    let totalConverted = 0;
    for (const agg of stats.aggregates) {
      if (agg.eventType === 'email_sent') emailsSentToday += agg.count;
      if (agg.eventType === 'email_opened') totalOpened += agg.count;
      if (agg.eventType === 'email_clicked') totalClicked += agg.count;
      if (
        agg.eventType === 'conversion' ||
        agg.eventType === 'deal_won' ||
        agg.eventType === 'form_submitted'
      ) {
        totalConverted += agg.count;
      }
    }

    const openRate =
      emailsSentToday > 0 ? (totalOpened / emailsSentToday) * 100 : 0;
    const clickRate =
      emailsSentToday > 0 ? (totalClicked / emailsSentToday) * 100 : 0;
    const conversionRate =
      emailsSentToday > 0 ? (totalConverted / emailsSentToday) * 100 : 0;

    return c.json({
      totalContacts: kpis.totalContacts,
      activeJourneys: kpis.activeJourneys,
      campaignsSent: kpis.campaignsSent,
      emailsSentToday,
      openRate: Math.round(openRate * 100) / 100,
      clickRate: Math.round(clickRate * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      recentActivity: stats.recentActivity,
    });
  } catch (error) {
    console.error('Overview stats error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get overview stats' },
      500,
    );
  }
});

// GET /api/v1/analytics/campaigns/:id/performance - Campaign performance
dashboardRoutes.get(
  '/api/v1/analytics/campaigns/:id/performance',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const campaignId = c.req.param('id');
    const { startDate, endDate } = c.req.query();

    try {
      const dailyStats = await getCampaignStats(
        db,
        tenant.organizationId,
        campaignId,
        {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      );

      // Compute totals from daily stats
      let sent = 0,
        delivered = 0,
        opened = 0,
        clicked = 0,
        bounced = 0,
        complained = 0,
        unsubscribed = 0;

      for (const day of dailyStats) {
        sent += day.sent;
        delivered += day.delivered;
        opened += day.opened;
        clicked += day.clicked;
        bounced += day.bounced;
        complained += day.complained;
        unsubscribed += day.unsubscribed;
      }

      const uniqueOpened = dailyStats.reduce(
        (sum, d) => sum + d.uniqueOpened,
        0,
      );
      const uniqueClicked = dailyStats.reduce(
        (sum, d) => sum + d.uniqueClicked,
        0,
      );

      return c.json({
        campaignId,
        campaignName: campaignId,
        totalRecipients: sent,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        complained,
        unsubscribed,
        openRate:
          sent > 0 ? Math.round((uniqueOpened / sent) * 10000) / 100 : 0,
        clickRate:
          sent > 0 ? Math.round((uniqueClicked / sent) * 10000) / 100 : 0,
        clickToOpenRate:
          uniqueOpened > 0
            ? Math.round((uniqueClicked / uniqueOpened) * 10000) / 100
            : 0,
        bounceRate: sent > 0 ? Math.round((bounced / sent) * 10000) / 100 : 0,
        dailyStats,
      });
    } catch (error) {
      console.error('Campaign performance error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get campaign performance',
        },
        500,
      );
    }
  },
);

// GET /api/v1/analytics/journeys/:id/performance - Journey performance
dashboardRoutes.get('/api/v1/analytics/journeys/:id/performance', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const journeyId = c.req.param('id');

  try {
    const dailyStats = await getJourneyStats(
      db,
      tenant.organizationId,
      journeyId,
    );

    let totalStarted = 0,
      totalCompleted = 0,
      totalFailed = 0,
      currentlyActive = 0;

    for (const day of dailyStats) {
      totalStarted += day.started;
      totalCompleted += day.completed;
      totalFailed += day.failed;
      currentlyActive += day.active;
    }

    return c.json({
      journeyId,
      journeyName: journeyId,
      totalStarted,
      totalCompleted,
      totalFailed,
      currentlyActive,
      completionRate:
        totalStarted > 0
          ? Math.round((totalCompleted / totalStarted) * 10000) / 100
          : 0,
      avgTimeToComplete: null,
      dailyStats,
      stepStats: [],
    });
  } catch (error) {
    console.error('Journey performance error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get journey performance' },
      500,
    );
  }
});
