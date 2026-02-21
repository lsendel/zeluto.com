import type { FC } from 'hono/jsx';

export interface CampaignDailyStatRow {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
}

export interface CampaignPerfProps {
  campaignId: string;
  dailyStats: CampaignDailyStatRow[];
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

export const CampaignPerfView: FC<CampaignPerfProps> = ({
  campaignId,
  dailyStats,
}) => {
  // Sum totals
  const totals = dailyStats.reduce(
    (acc, d) => ({
      sent: acc.sent + d.sent,
      delivered: acc.delivered + d.delivered,
      opened: acc.opened + d.opened,
      clicked: acc.clicked + d.clicked,
      bounced: acc.bounced + d.bounced,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 },
  );

  const openRate =
    totals.sent > 0 ? ((totals.opened / totals.sent) * 100).toFixed(1) : '0.0';
  const clickRate =
    totals.sent > 0 ? ((totals.clicked / totals.sent) * 100).toFixed(1) : '0.0';

  return (
    <div id="campaign-perf">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 mb-4">
        <a
          href="/app/analytics"
          hx-get="/app/analytics"
          hx-target="#app-content"
          hx-push-url="true"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Analytics
        </a>
        <span class="text-gray-400">/</span>
        <span class="text-sm text-gray-900">Campaign Performance</span>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-6">
        Campaign Performance
      </h1>

      {/* Summary cards */}
      <div class="grid gap-4 md:grid-cols-5 mb-6">
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-sm text-gray-500">Sent</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900">
            {formatNumber(totals.sent)}
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-sm text-gray-500">Delivered</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900">
            {formatNumber(totals.delivered)}
          </p>
        </div>
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-sm text-gray-500">Opens</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900">
            {formatNumber(totals.opened)}
          </p>
          <p class="text-xs text-gray-400">{openRate}% rate</p>
        </div>
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-sm text-gray-500">Clicks</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900">
            {formatNumber(totals.clicked)}
          </p>
          <p class="text-xs text-gray-400">{clickRate}% rate</p>
        </div>
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <p class="text-sm text-gray-500">Bounced</p>
          <p class="mt-1 text-2xl font-semibold text-gray-900">
            {formatNumber(totals.bounced)}
          </p>
        </div>
      </div>

      {/* Daily breakdown */}
      {dailyStats.length > 0 && (
        <div class="overflow-hidden rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Date
                </th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Sent
                </th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Delivered
                </th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Opened
                </th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Clicked
                </th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Bounced
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              {dailyStats.map((d) => (
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-3 text-sm text-gray-900">{d.date}</td>
                  <td class="px-6 py-3 text-sm text-gray-700">
                    {formatNumber(d.sent)}
                  </td>
                  <td class="px-6 py-3 text-sm text-gray-700">
                    {formatNumber(d.delivered)}
                  </td>
                  <td class="px-6 py-3 text-sm text-gray-700">
                    {formatNumber(d.opened)}
                  </td>
                  <td class="px-6 py-3 text-sm text-gray-700">
                    {formatNumber(d.clicked)}
                  </td>
                  <td class="px-6 py-3 text-sm text-gray-700">
                    {formatNumber(d.bounced)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
