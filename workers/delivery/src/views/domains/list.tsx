import type { FC } from 'hono/jsx';

export interface DomainRow {
  id: string;
  domain: string;
  status: string;
  verified_at: Date | string | null;
  created_at: Date | string;
}

export interface DomainListProps {
  domains: DomainRow[];
}

const statusColors: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  verified: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
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

export const DomainListView: FC<DomainListProps> = ({ domains }) => {
  return (
    <div id="domain-list">
      {/* Header */}
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Sending Domains</h1>
          <p class="mt-1 text-sm text-gray-500">
            {domains.length} domains configured
          </p>
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
            class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
          >
            Domains
          </a>
          <a
            href="/app/delivery/suppressions"
            hx-get="/app/delivery/suppressions"
            hx-target="#app-content"
            hx-push-url="true"
            class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
          >
            Suppressions
          </a>
        </nav>
      </div>

      {/* Domain table */}
      {domains.length === 0 ? (
        <div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p class="text-sm text-gray-500">
            No sending domains configured. Add a domain via the API to start
            verifying.
          </p>
        </div>
      ) : (
        <div class="overflow-hidden rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Domain
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
                  Verified
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
              {domains.map((d) => {
                const colors = statusColors[d.status] ?? {
                  bg: 'bg-gray-100',
                  text: 'text-gray-700',
                };
                return (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <a
                        href={`/app/delivery/domains/${d.id}`}
                        hx-get={`/app/delivery/domains/${d.id}`}
                        hx-target="#app-content"
                        hx-push-url="true"
                        class="text-sm font-medium text-gray-900 hover:text-brand-600"
                      >
                        {d.domain}
                      </a>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(d.verified_at)}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {d.status === 'pending' && (
                        <button
                          hx-post={`/api/v1/delivery/sending-domains/${d.id}/verify`}
                          hx-target="#app-content"
                          class="text-sm text-brand-600 hover:text-brand-800 font-medium"
                        >
                          Verify
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
