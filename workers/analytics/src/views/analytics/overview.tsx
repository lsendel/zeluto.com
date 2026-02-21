import type { FC } from 'hono/jsx';

export interface AnalyticsOverviewProps {
  totalEvents: number;
  recentReports: Array<{
    id: string;
    name: string;
    createdAt: Date | string;
  }>;
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const AnalyticsOverviewView: FC<AnalyticsOverviewProps> = ({
  totalEvents,
  recentReports,
}) => {
  return (
    <div id="analytics-overview">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Analytics</h1>
          <p class="mt-1 text-sm text-gray-500">
            {totalEvents.toLocaleString()} total events tracked
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div class="grid gap-4 md:grid-cols-2 mb-6">
        <a
          href="/app/dashboard"
          hx-get="/app/dashboard"
          hx-target="#app-content"
          hx-push-url="true"
          class="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
        >
          <p class="text-sm font-semibold text-gray-900">Dashboard</p>
          <p class="mt-1 text-xs text-gray-500">
            Overview KPIs, today's metrics, and recent activity
          </p>
        </a>
        <div class="rounded-lg border border-gray-200 bg-white p-5">
          <p class="text-sm font-semibold text-gray-900">
            Campaign Performance
          </p>
          <p class="mt-1 text-xs text-gray-500">
            View per-campaign analytics from the campaigns page
          </p>
        </div>
      </div>

      {/* Saved reports */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">
          Saved Reports
        </h3>
        {recentReports.length === 0 ? (
          <p class="text-sm text-gray-500">
            No reports created yet. Use the API to create funnel reports.
          </p>
        ) : (
          <div class="space-y-3">
            {recentReports.map((report) => (
              <div class="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50">
                <div>
                  <p class="text-sm font-medium text-gray-900">{report.name}</p>
                  <p class="text-xs text-gray-400">
                    Created {formatDate(report.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
