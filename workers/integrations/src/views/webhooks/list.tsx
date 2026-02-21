import type { FC } from 'hono/jsx';

export interface WebhookRow {
  id: string;
  url: string;
  events: unknown;
  isActive: boolean;
  lastTriggeredAt: Date | string | null;
  createdAt: Date | string;
}

export interface WebhookListProps {
  webhooks: WebhookRow[];
  total: number;
}

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

export const WebhookListView: FC<WebhookListProps> = ({
  webhooks,
  total,
}) => {
  return (
    <div id="webhook-list">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p class="mt-1 text-sm text-gray-500">{total} webhooks</p>
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
            class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
          >
            Connections
          </a>
          <a
            href="/app/integrations/webhooks"
            hx-get="/app/integrations/webhooks"
            hx-target="#app-content"
            hx-push-url="true"
            class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
          >
            Webhooks
          </a>
        </nav>
      </div>

      {/* Webhook table */}
      {webhooks.length === 0 ? (
        <div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p class="text-sm text-gray-500">
            No webhooks configured. Create one via the API to start receiving
            events.
          </p>
        </div>
      ) : (
        <div class="overflow-hidden rounded-lg border border-gray-200">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  URL
                </th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Events
                </th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Last Triggered
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              {webhooks.map((w) => {
                const events = Array.isArray(w.events)
                  ? (w.events as string[])
                  : [];
                return (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-900 truncate max-w-xs font-mono">
                      {w.url}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {events.length > 0 ? events.join(', ') : '-'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          w.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {w.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(w.lastTriggeredAt)}
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
