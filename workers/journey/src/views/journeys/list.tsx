import type { FC } from 'hono/jsx';
import type { JourneyRow } from '../../infrastructure/repositories/journey-repository.js';

export interface JourneyListProps {
  journeys: JourneyRow[];
  total: number;
  page: number;
  limit: number;
}

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
  paused: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Paused' },
  archived: { bg: 'bg-red-100', text: 'text-red-700', label: 'Archived' },
};

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
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
      aria-label="Journey list pagination"
    >
      <div class="hidden sm:block">
        <p class="text-sm text-gray-700">
          Showing page <span class="font-medium">{page}</span> of{' '}
          <span class="font-medium">{totalPages}</span>{' '}
          <span class="text-gray-500">({total} journeys)</span>
        </p>
      </div>
      <div class="flex flex-1 justify-between gap-1 sm:justify-end">
        {hasPrev ? (
          <a
            href={`/app/journey/journeys?page=${page - 1}`}
            hx-get={`/app/journey/journeys?page=${page - 1}`}
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
            href={`/app/journey/journeys?page=${page + 1}`}
            hx-get={`/app/journey/journeys?page=${page + 1}`}
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

export const JourneyListView: FC<JourneyListProps> = ({
  journeys,
  total,
  page,
  limit,
}) => {
  return (
    <div id="journey-list">
      {/* Header */}
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Journeys</h1>
          <p class="mt-1 text-sm text-gray-500">{total} total journeys</p>
        </div>
        <button
          hx-get="/app/journey/journeys/new"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + New Journey
        </button>
      </div>

      {/* Status filter tabs */}
      <div class="mb-4 flex gap-2">
        {['all', 'draft', 'active', 'paused', 'archived'].map((s) => (
          <button
            key={s}
            hx-get={`/app/journey/journeys${s === 'all' ? '' : `?status=${s}`}`}
            hx-target="#app-content"
            hx-push-url="true"
            class="rounded-full px-3 py-1 text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors capitalize"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div class="overflow-hidden rounded-lg border border-gray-200">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Name
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Updated
                </th>
                <th scope="col" class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              {journeys.length === 0 ? (
                <tr>
                  <td colspan={4} class="px-6 py-12 text-center text-sm text-gray-500">
                    No journeys found. Create your first journey to get started.
                  </td>
                </tr>
              ) : (
                journeys.map((j) => {
                  const badge = statusBadge[j.status] ?? statusBadge.draft;
                  return (
                    <tr key={j.id} class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <a
                          href={`/app/journey/journeys/${j.id}`}
                          hx-get={`/app/journey/journeys/${j.id}`}
                          hx-target="#app-content"
                          hx-push-url="true"
                          class="text-sm font-medium text-brand-600 hover:text-brand-800"
                        >
                          {j.name}
                        </a>
                        {j.description && (
                          <p class="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{j.description}</p>
                        )}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(j.updated_at)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <div class="flex items-center gap-2">
                          <button
                            hx-get={`/app/journey/journeys/${j.id}/edit`}
                            hx-target="#app-content"
                            hx-push-url="true"
                            class="text-gray-500 hover:text-gray-700"
                          >
                            Edit
                          </button>
                          <button
                            hx-delete={`/api/v1/journey/journeys/${j.id}`}
                            hx-confirm="Are you sure you want to delete this journey?"
                            hx-target="#app-content"
                            class="text-red-500 hover:text-red-700"
                          >
                            Delete
                          </button>
                        </div>
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
