import type { FC } from 'hono/jsx';

export interface DashboardOverviewProps {
  kpis: {
    totalContacts: number;
    activeJourneys: number;
    campaignsSent: number;
  };
  todayStats: {
    emailsSent: number;
    opens: number;
    clicks: number;
    conversions: number;
  };
  recentActivity: Array<{
    id: string;
    contactId: string;
    eventType: string;
    eventSource: string | null;
    createdAt: Date | string;
  }>;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function computeRate(
  numerator: number,
  denominator: number,
): string {
  if (denominator === 0) return '0.0%';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

const KpiCard: FC<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
    <p class="text-sm text-gray-500">{label}</p>
    <p class="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
    {sub && <p class="mt-1 text-xs text-gray-400">{sub}</p>}
  </div>
);

const eventLabels: Record<string, string> = {
  email_sent: 'Email sent',
  email_opened: 'Email opened',
  email_clicked: 'Link clicked',
  form_submitted: 'Form submitted',
  page_visited: 'Page visited',
  conversion: 'Conversion',
  deal_won: 'Deal won',
};

export const DashboardOverviewView: FC<DashboardOverviewProps> = ({
  kpis,
  todayStats,
  recentActivity,
}) => {
  return (
    <div id="dashboard-overview">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* KPI cards */}
      <div class="grid gap-4 md:grid-cols-3 mb-6">
        <KpiCard label="Total Contacts" value={formatNumber(kpis.totalContacts)} />
        <KpiCard
          label="Active Journeys"
          value={formatNumber(kpis.activeJourneys)}
        />
        <KpiCard
          label="Campaigns Sent"
          value={formatNumber(kpis.campaignsSent)}
        />
      </div>

      {/* Today's metrics */}
      <div class="grid gap-4 md:grid-cols-4 mb-6">
        <KpiCard label="Emails Today" value={formatNumber(todayStats.emailsSent)} />
        <KpiCard
          label="Opens"
          value={formatNumber(todayStats.opens)}
          sub={computeRate(todayStats.opens, todayStats.emailsSent)}
        />
        <KpiCard
          label="Clicks"
          value={formatNumber(todayStats.clicks)}
          sub={computeRate(todayStats.clicks, todayStats.emailsSent)}
        />
        <KpiCard
          label="Conversions"
          value={formatNumber(todayStats.conversions)}
        />
      </div>

      {/* Recent activity */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Recent Activity
        </h3>
        {recentActivity.length === 0 ? (
          <p class="text-sm text-gray-500">
            No activity yet today. Events will appear as contacts interact with
            your campaigns.
          </p>
        ) : (
          <div class="space-y-3">
            {recentActivity.map((event) => (
              <div class="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0">
                <div class="flex items-center gap-3">
                  <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    {event.contactId.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p class="text-sm text-gray-900">
                      {eventLabels[event.eventType] ?? event.eventType}
                    </p>
                    {event.eventSource && (
                      <p class="text-xs text-gray-400 truncate max-w-xs">
                        {event.eventSource}
                      </p>
                    )}
                  </div>
                </div>
                <span class="text-xs text-gray-400">
                  {formatDate(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
