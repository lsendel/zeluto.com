import type { FC } from 'hono/jsx';

export interface SyncJobRow {
  id: string;
  direction: string;
  entityType: string;
  status: string;
  recordsProcessed: number;
  recordsFailed: number;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
}

export interface ConnectionDetailProps {
  connection: {
    id: string;
    provider: string;
    name: string;
    status: string;
    lastSyncAt: Date | string | null;
    createdAt: Date | string;
  };
  syncJobs: SyncJobRow[];
}

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-500' },
  error: { bg: 'bg-red-100', text: 'text-red-700' },
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

export const ConnectionDetailView: FC<ConnectionDetailProps> = ({
  connection,
  syncJobs,
}) => {
  const colors = statusColors[connection.status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  };

  return (
    <div id="connection-detail">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 mb-4">
        <a
          href="/app/integrations"
          hx-get="/app/integrations/connections"
          hx-target="#app-content"
          hx-push-url="/app/integrations"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Integrations
        </a>
        <span class="text-gray-400">/</span>
        <span class="text-sm text-gray-900">{connection.name}</span>
      </div>

      {/* Header */}
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-gray-900">{connection.name}</h1>
            <span
              class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
            >
              {connection.status}
            </span>
          </div>
          <p class="mt-1 text-sm text-gray-500">
            Provider: {connection.provider} · Created{' '}
            {formatDate(connection.createdAt)}
          </p>
        </div>
        <button
          hx-post={`/api/v1/integrations/connections/${connection.id}/test`}
          hx-target="#app-content"
          class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Test Connection
        </button>
      </div>

      {/* Sync history */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Sync History</h3>
        {syncJobs.length === 0 ? (
          <p class="text-sm text-gray-500">No sync jobs recorded yet.</p>
        ) : (
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Direction
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Entity
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Records
                  </th>
                  <th class="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200">
                {syncJobs.map((job) => {
                  const jobColors = statusColors[job.status] ?? {
                    bg: 'bg-gray-100',
                    text: 'text-gray-700',
                  };
                  return (
                    <tr>
                      <td class="px-4 py-3 text-sm text-gray-900 capitalize">
                        {job.direction}
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-700">
                        {job.entityType}
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${jobColors.bg} ${jobColors.text}`}
                        >
                          {job.status}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-700">
                        {job.recordsProcessed}
                        {job.recordsFailed > 0 && (
                          <span class="text-red-500 ml-1">
                            ({job.recordsFailed} failed)
                          </span>
                        )}
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-500">
                        {formatDate(job.startedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
