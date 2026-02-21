import type { FC } from 'hono/jsx';

interface DnsRecord {
  type?: string;
  name?: string;
  value?: string;
  verified?: boolean;
}

export interface DomainDetailProps {
  domain: {
    id: string;
    domain: string;
    status: string;
    dns_records: unknown;
    verified_at: Date | string | null;
    created_at: Date | string;
  };
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DomainDetailView: FC<DomainDetailProps> = ({ domain }) => {
  const colors = statusColors[domain.status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  };
  const records = (Array.isArray(domain.dns_records)
    ? domain.dns_records
    : []) as DnsRecord[];

  return (
    <div id="domain-detail">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 mb-4">
        <a
          href="/app/delivery/domains"
          hx-get="/app/delivery/domains"
          hx-target="#app-content"
          hx-push-url="true"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Domains
        </a>
        <span class="text-gray-400">/</span>
        <span class="text-sm text-gray-900">{domain.domain}</span>
      </div>

      {/* Header */}
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-gray-900">{domain.domain}</h1>
            <span
              class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
            >
              {domain.status}
            </span>
          </div>
          <p class="mt-1 text-sm text-gray-500">
            Added {formatDate(domain.created_at)}
            {domain.verified_at &&
              ` · Verified ${formatDate(domain.verified_at)}`}
          </p>
        </div>
        {domain.status !== 'verified' && (
          <button
            hx-post={`/api/v1/delivery/sending-domains/${domain.id}/verify`}
            hx-target="#app-content"
            class="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            Verify DNS
          </button>
        )}
      </div>

      {/* DNS records table */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">DNS Records</h3>
        {records.length === 0 ? (
          <p class="text-sm text-gray-500">
            No DNS records available. Click "Verify DNS" to generate records.
          </p>
        ) : (
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Type
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Name
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Value
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                {records.map((rec) => (
                  <tr>
                    <td class="px-4 py-3 text-sm font-mono text-gray-900">
                      {rec.type ?? '-'}
                    </td>
                    <td class="px-4 py-3 text-sm font-mono text-gray-700 max-w-xs truncate">
                      {rec.name ?? '-'}
                    </td>
                    <td class="px-4 py-3 text-sm font-mono text-gray-700 max-w-sm truncate">
                      {rec.value ?? '-'}
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          rec.verified
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {rec.verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
