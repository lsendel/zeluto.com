import type { FC } from 'hono/jsx';

export interface ConnectionRow {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastSyncAt: Date | string | null;
  createdAt: Date | string;
}

export interface ConnectionListProps {
  connections: ConnectionRow[];
  total: number;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-500' },
  error: { bg: 'bg-red-100', text: 'text-red-700' },
};

const providerLabels: Record<string, string> = {
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  zapier: 'Zapier',
  webhook: 'Webhook',
  custom: 'Custom',
};

function formatDate(d: Date | string | null): string {
  if (!d) return 'Never';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ConnectionListView: FC<ConnectionListProps> = ({
  connections,
  total,
}) => {
  return (
    <div id="connection-list">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Integrations</h1>
          <p class="mt-1 text-sm text-gray-500">{total} connections</p>
        </div>
      </div>

      {/* Sub-navigation */}
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-6" aria-label="Integrations tabs">
          <a
            href="/app/integrations"
            hx-get="/app/integrations/connections"
            hx-target="#app-content"
            hx-push-url="/app/integrations"
            class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
          >
            Connections
          </a>
          <a
            href="/app/integrations/webhooks"
            hx-get="/app/integrations/webhooks"
            hx-target="#app-content"
            hx-push-url="true"
            class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
          >
            Webhooks
          </a>
        </nav>
      </div>

      {/* Connection cards */}
      {connections.length === 0 ? (
        <div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p class="text-sm text-gray-500">
            No integrations configured. Connect your first service via the API.
          </p>
        </div>
      ) : (
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn) => {
            const colors = statusColors[conn.status] ?? {
              bg: 'bg-gray-100',
              text: 'text-gray-700',
            };
            return (
              <a
                href={`/app/integrations/connections/${conn.id}`}
                hx-get={`/app/integrations/connections/${conn.id}`}
                hx-target="#app-content"
                hx-push-url="true"
                class="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow"
              >
                <div class="flex items-start justify-between mb-2">
                  <div>
                    <p class="text-sm font-semibold text-gray-900">
                      {conn.name}
                    </p>
                    <p class="text-xs text-gray-500 mt-0.5">
                      {providerLabels[conn.provider] ?? conn.provider}
                    </p>
                  </div>
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                  >
                    {conn.status}
                  </span>
                </div>
                <p class="text-xs text-gray-400">
                  Last sync: {formatDate(conn.lastSyncAt)}
                </p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
};
