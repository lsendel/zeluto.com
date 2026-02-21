import type { FC } from 'hono/jsx';

export interface SuppressionRow {
  id: string;
  email: string;
  reason: string;
  source: string | null;
  created_at: Date | string;
}

export interface SuppressionListProps {
  suppressions: SuppressionRow[];
  total: number;
  page: number;
  limit: number;
}

const reasonColors: Record<string, { bg: string; text: string }> = {
  bounce: { bg: 'bg-red-100', text: 'text-red-700' },
  complaint: { bg: 'bg-orange-100', text: 'text-orange-700' },
  unsubscribe: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  manual: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
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
      aria-label="Suppression list pagination"
    >
      <div class="hidden sm:block">
        <p class="text-sm text-gray-700">
          Page <span class="font-medium">{page}</span> of{' '}
          <span class="font-medium">{totalPages}</span>{' '}
          <span class="text-gray-500">({total} entries)</span>
        </p>
      </div>
      <div class="flex flex-1 justify-between gap-1 sm:justify-end">
        {hasPrev ? (
          <a
            href={`/app/delivery/suppressions?page=${page - 1}`}
            hx-get={`/app/delivery/suppressions?page=${page - 1}`}
            hx-target="#app-content"
            hx-push-url="true"
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
            href={`/app/delivery/suppressions?page=${page + 1}`}
            hx-get={`/app/delivery/suppressions?page=${page + 1}`}
            hx-target="#app-content"
            hx-push-url="true"
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

export const SuppressionListView: FC<SuppressionListProps> = ({
  suppressions,
  total,
  page,
  limit,
}) => {
  return (
    <div id="suppression-list">
      {/* Header */}
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Suppression List</h1>
          <p class="mt-1 text-sm text-gray-500">{total} suppressed emails</p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-6" aria-label="Delivery tabs">
          <a
            href="/app/delivery"
            hx-get="/app/delivery/providers"
            hx-target="#app-content"
            hx-push-url="/app/delivery"
            class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
          >
            Providers
          </a>
          <a
            href="/app/delivery/domains"
            hx-get="/app/delivery/domains"
            hx-target="#app-content"
            hx-push-url="true"
            class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
          >
            Domains
          </a>
          <a
            href="/app/delivery/suppressions"
            hx-get="/app/delivery/suppressions"
            hx-target="#app-content"
            hx-push-url="true"
            class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
          >
            Suppressions
          </a>
        </nav>
      </div>

      {/* Table */}
      <div class="overflow-hidden rounded-lg border border-gray-200">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Email
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Reason
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Source
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Date
              </th>
              <th
                scope="col"
                class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            {suppressions.length === 0 ? (
              <tr>
                <td
                  colspan={5}
                  class="px-6 py-12 text-center text-sm text-gray-500"
                >
                  No suppressions found.
                </td>
              </tr>
            ) : (
              suppressions.map((s) => {
                const colors = reasonColors[s.reason] ?? {
                  bg: 'bg-gray-100',
                  text: 'text-gray-700',
                };
                return (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-900">{s.email}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {s.reason}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {s.source ?? '-'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(s.created_at)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <button
                        hx-delete={`/api/v1/delivery/suppressions/${s.id}`}
                        hx-confirm={`Remove ${s.email} from suppression list?`}
                        hx-target="#app-content"
                        class="text-sm text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        <Pagination total={total} page={page} limit={limit} />
      </div>
    </div>
  );
};
