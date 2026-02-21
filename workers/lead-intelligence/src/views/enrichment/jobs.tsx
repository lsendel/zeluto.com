import type { FC } from 'hono/jsx';
import type { EnrichmentJobRow } from '../../infrastructure/repositories/enrichment-job-repository.js';

export interface EnrichmentJobListProps {
  jobs: EnrichmentJobRow[];
  total: number;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  running: { bg: 'bg-blue-100', text: 'text-blue-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
};

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const EnrichmentJobListView: FC<EnrichmentJobListProps> = ({
  jobs,
  total,
}) => {
  return (
    <div id="enrichment-jobs">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Enrichment Jobs</h1>
          <p class="mt-1 text-sm text-gray-500">{total} total jobs</p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-6" aria-label="Lead Intelligence tabs">
          <a
            href="/app/lead-intelligence/providers"
            hx-get="/app/lead-intelligence/providers"
            hx-target="#app-content"
            hx-push-url="true"
            class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
          >
            Providers
          </a>
          <a
            href="/app/lead-intelligence/jobs"
            hx-get="/app/lead-intelligence/jobs"
            hx-target="#app-content"
            hx-push-url="true"
            class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
          >
            Jobs
          </a>
        </nav>
      </div>

      <div class="overflow-hidden rounded-lg border border-gray-200">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Contact
              </th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Fields
              </th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            {jobs.length === 0 ? (
              <tr>
                <td
                  colspan={4}
                  class="px-6 py-12 text-center text-sm text-gray-500"
                >
                  No enrichment jobs found.
                </td>
              </tr>
            ) : (
              jobs.map((j) => {
                const colors = statusColors[j.status] ?? {
                  bg: 'bg-gray-100',
                  text: 'text-gray-700',
                };
                return (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-900 font-mono">
                      {j.contact_id.slice(0, 8)}...
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {j.field_requests?.length
                        ? `${j.field_requests.length} fields`
                        : '-'}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {formatDate(j.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
