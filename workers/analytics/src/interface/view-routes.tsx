import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  getOverviewKpis,
  getOverviewStats,
  getCampaignStats,
} from '../infrastructure/repositories/dashboard-repository.js';
import { findAllReports } from '../infrastructure/repositories/report-repository.js';
import { queryEvents } from '../infrastructure/repositories/event-repository.js';
import { CampaignPerfView } from '../views/analytics/campaign-perf.js';
import { AnalyticsOverviewView } from '../views/analytics/overview.js';
import { DashboardOverviewView } from '../views/dashboard/overview.js';

/**
 * HTMX view routes for the Analytics worker.
 *
 * Serves both Dashboard (`/app/dashboard`) and Analytics (`/app/analytics/*`) views.
 */
export const viewRoutes = new Hono<Env>();

// GET /app/dashboard — Dashboard overview
viewRoutes.get('/app/dashboard', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const [kpis, stats] = await Promise.all([
      getOverviewKpis(db, tenant.organizationId),
      getOverviewStats(db, tenant.organizationId),
    ]);

    // Derive today's email metrics from aggregates
    const emailsSent =
      stats.aggregates.find((a) => a.eventType === 'email_sent')?.count ?? 0;
    const opens =
      stats.aggregates.find((a) => a.eventType === 'email_opened')?.count ?? 0;
    const clicks =
      stats.aggregates.find((a) => a.eventType === 'email_clicked')?.count ?? 0;
    const conversions =
      (stats.aggregates.find((a) => a.eventType === 'conversion')?.count ?? 0) +
      (stats.aggregates.find((a) => a.eventType === 'deal_won')?.count ?? 0) +
      (stats.aggregates.find((a) => a.eventType === 'form_submitted')
        ?.count ?? 0);

    return c.html(
      <DashboardOverviewView
        kpis={kpis}
        todayStats={{ emailsSent, opens, clicks, conversions }}
        recentActivity={stats.recentActivity.map((a) => ({
          id: a.id,
          contactId: a.contactId,
          eventType: a.eventType,
          eventSource: a.eventSource,
          createdAt: a.createdAt,
        }))}
      />,
    );
  } catch (error) {
    console.error('View: dashboard overview error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load dashboard. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/analytics — Analytics hub
viewRoutes.get('/app/analytics', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const [eventsResult, reportsResult] = await Promise.all([
      queryEvents(db, tenant.organizationId, { page: 1, limit: 1 }),
      findAllReports(db, tenant.organizationId, { page: 1, limit: 5 }),
    ]);

    return c.html(
      <AnalyticsOverviewView
        totalEvents={eventsResult.total}
        recentReports={reportsResult.data.map((r) => ({
          id: r.id,
          name: r.name,
          createdAt: r.createdAt,
        }))}
      />,
    );
  } catch (error) {
    console.error('View: analytics overview error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load analytics. Please try again.
      </div>,
      500,
    );
  }
});

// GET /app/analytics/campaigns/:id — Campaign performance
viewRoutes.get('/app/analytics/campaigns/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const campaignId = c.req.param('id');

  try {
    const dailyStats = await getCampaignStats(
      db,
      tenant.organizationId,
      campaignId,
    );

    return c.html(
      <CampaignPerfView
        campaignId={campaignId}
        dailyStats={dailyStats.map((d) => ({
          date: typeof d.date === 'string' ? d.date : String(d.date),
          sent: d.sent,
          delivered: d.delivered,
          opened: d.opened,
          clicked: d.clicked ?? 0,
          bounced: d.bounced,
          complained: d.complained,
          unsubscribed: d.unsubscribed,
        }))}
      />,
    );
  } catch (error) {
    console.error('View: campaign performance error:', error);
    return c.html(
      <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load campaign performance. Please try again.
      </div>,
      500,
    );
  }
});
