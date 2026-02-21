import type { Campaign } from '@mauntic/campaign-domain';
import type { FC } from 'hono/jsx';

export interface CampaignListProps {
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700' },
  sending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  sent: { bg: 'bg-green-100', text: 'text-green-700' },
  paused: { bg: 'bg-orange-100', text: 'text-orange-700' },
  canceled: { bg: 'bg-red-100', text: 'text-red-700' },
};

function formatDate(d: Date | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const Pagination: FC<{ total: number; page: number; limit: number }> = ({
  total,
  page,
  limit,
}) => {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
      aria-label="Campaign list pagination"
    >
      <div class="hidden sm:block">
        <p class="text-sm text-gray-700">
          Page <span class="font-medium">{page}</span> of{' '}
          <span class="font-medium">{totalPages}</span>{' '}
          <span class="text-gray-500">({total} campaigns)</span>
        </p>
      </div>
      <div class="flex flex-1 justify-between gap-1 sm:justify-end">
        {hasPrev ? (
          <a
            href={`/app/campaigns?page=${page - 1}`}
            hx-get={`/app/campaign/campaigns?page=${page - 1}`}
            hx-target="#app-content"
            hx-push-url={`/app/campaigns?page=${page - 1}`}
            class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Previous
          </a>
        ) : (
          <span class="relative inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
            Previous
          </span>
        )}
        {hasNext ? (
          <a
            href={`/app/campaigns?page=${page + 1}`}
            hx-get={`/app/campaign/campaigns?page=${page + 1}`}
            hx-target="#app-content"
            hx-push-url={`/app/campaigns?page=${page + 1}`}
            class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Next
          </a>
        ) : (
          <span class="relative inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
            Next
          </span>
        )}
      </div>
    </nav>
  );
};

export const CampaignListView: FC<CampaignListProps> = ({
  campaigns,
  total,
  page,
  limit,
}) => {
  return (
    <div id="campaign-list">
      {/* Header */}
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p class="mt-1 text-sm text-gray-500">{total} total campaigns</p>
        </div>
        <a
          href="/app/campaigns/new"
          hx-get="/app/campaign/campaigns/new"
          hx-target="#app-content"
          hx-push-url="/app/campaigns/new"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + New Campaign
        </a>
      </div>

      {/* Search */}
      <div class="mb-4">
        <input
          type="search"
          name="search"
          placeholder="Search campaigns by name..."
          class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          hx-get="/app/campaign/campaigns"
          hx-target="#app-content"
          hx-trigger="keyup changed delay:300ms"
          hx-push-url="/app/campaigns"
          hx-include="this"
        />
      </div>

      {/* Table */}
      <div class="overflow-hidden rounded-lg border border-gray-200">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Name
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Type
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Sent
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Open Rate
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Updated
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              {campaigns.length === 0 ? (
                <tr>
                  <td
                    colspan={6}
                    class="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No campaigns found. Create your first campaign to get
                    started.
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => {
                  const colors = statusColors[c.status] ?? {
                    bg: 'bg-gray-100',
                    text: 'text-gray-700',
                  };
                  return (
                    <tr class="hover:bg-gray-50 transition-colors">
                      <td class="px-6 py-4">
                        <a
                          href={`/app/campaigns/${c.id}`}
                          hx-get={`/app/campaign/campaigns/${c.id}`}
                          hx-target="#app-content"
                          hx-push-url={`/app/campaigns/${c.id}`}
                          class="text-sm font-medium text-gray-900 hover:text-brand-600"
                        >
                          {c.name}
                        </a>
                        {c.subject && (
                          <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                            {c.subject}
                          </p>
                        )}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {c.type}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {c.sentCount.toLocaleString()}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {c.sentCount > 0 ? formatRate(c.openRate) : '-'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(c.updatedAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination total={total} page={page} limit={limit} />
      </div>
    </div>
  );
};
