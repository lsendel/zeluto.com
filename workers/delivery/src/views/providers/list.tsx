import type { FC } from 'hono/jsx';

export interface ProviderRow {
  id: string;
  channel: string;
  provider_type: string;
  is_active: boolean;
  priority: number;
  created_at: Date | string;
}

export interface ProviderListProps {
  providers: ProviderRow[];
}

const providerLabels: Record<string, string> = {
  ses: 'Amazon SES',
  sendgrid: 'SendGrid',
  postmark: 'Postmark',
  twilio: 'Twilio',
  custom_smtp: 'Custom SMTP',
};

export const ProviderListView: FC<ProviderListProps> = ({ providers }) => {
  return (
    <div id="provider-list">
      {/* Header */}
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Delivery Providers</h1>
          <p class="mt-1 text-sm text-gray-500">
            {providers.length} configured providers
          </p>
        </div>
        <a
          href="/app/delivery/providers/new"
          hx-get="/app/delivery/providers/new"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + Add Provider
        </a>
      </div>

      {/* Sub-navigation */}
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-6" aria-label="Delivery tabs">
          <a
            href="/app/delivery"
            hx-get="/app/delivery/providers"
            hx-target="#app-content"
            hx-push-url="/app/delivery"
            class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
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
            class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
          >
            Suppressions
          </a>
        </nav>
      </div>

      {/* Provider cards */}
      {providers.length === 0 ? (
        <div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p class="text-sm text-gray-500">
            No providers configured yet. Add your first email provider to start
            sending.
          </p>
        </div>
      ) : (
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <div class="rounded-lg border border-gray-200 bg-white p-5 hover:shadow-sm transition-shadow">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <p class="text-sm font-semibold text-gray-900">
                    {providerLabels[p.provider_type] ?? p.provider_type}
                  </p>
                  <p class="text-xs text-gray-500 capitalize mt-0.5">
                    {p.channel}
                  </p>
                </div>
                <span
                  class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {p.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div class="flex items-center justify-between text-xs text-gray-400">
                <span>Priority: {p.priority}</span>
                <a
                  href={`/app/delivery/providers/${p.id}/edit`}
                  hx-get={`/app/delivery/providers/${p.id}/edit`}
                  hx-target="#app-content"
                  hx-push-url="true"
                  class="text-brand-600 hover:text-brand-800 font-medium"
                >
                  Edit
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
