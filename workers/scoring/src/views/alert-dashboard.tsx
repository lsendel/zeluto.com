import type { FC } from 'hono/jsx';

export interface AlertItem {
  id: string;
  contactId: string;
  signalType: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  deadline: string;
  acknowledged: boolean;
}

export interface AlertDashboardProps {
  alerts: AlertItem[];
}

const PriorityBadge: FC<{ priority: string }> = ({ priority }) => {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-800',
  };

  return (
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[priority] ?? 'bg-gray-100 text-gray-800'}`}>
      {priority}
    </span>
  );
};

export const AlertDashboardView: FC<AlertDashboardProps> = ({ alerts }) => {
  const openAlerts = alerts.filter((a) => !a.acknowledged);
  return (
    <div id="alert-dashboard">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Signal Alerts</h1>
          <p class="mt-1 text-sm text-gray-500">{openAlerts.length} open alerts</p>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg border border-gray-200">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Priority</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Signal</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Contact</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Deadline</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            {alerts.length === 0 ? (
              <tr>
                <td colspan={5} class="px-6 py-12 text-center text-sm text-gray-500">
                  No alerts to display.
                </td>
              </tr>
            ) : (
              alerts.map((a) => (
                <tr class={a.acknowledged ? 'opacity-50' : ''}>
                  <td class="px-6 py-4"><PriorityBadge priority={a.priority} /></td>
                  <td class="px-6 py-4 text-sm text-gray-900">{a.signalType}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">{a.contactId.slice(0, 8)}...</td>
                  <td class="px-6 py-4 text-sm text-gray-500">{a.deadline}</td>
                  <td class="px-6 py-4">
                    {!a.acknowledged && (
                      <button
                        hx-post={`/api/v1/scoring/alerts/${a.id}/acknowledge`}
                        hx-target="#alert-dashboard"
                        hx-swap="outerHTML"
                        class="text-sm text-brand-600 hover:text-brand-800"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
