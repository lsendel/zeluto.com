import type { FC } from 'hono/jsx';

export interface ProviderFormProps {
  provider?: {
    id: string;
    channel: string;
    provider_type: string;
    is_active: boolean;
    priority: number;
  } | null;
  errors?: Record<string, string>;
}

export const ProviderFormView: FC<ProviderFormProps> = ({
  provider,
  errors = {},
}) => {
  const isEdit = !!provider;
  const title = isEdit ? 'Edit Provider' : 'Add Provider';
  const submitUrl = isEdit
    ? `/api/v1/delivery/providers/${provider?.id}`
    : '/api/v1/delivery/providers';

  return (
    <div id="provider-form">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 mb-6">
        <a
          href="/app/delivery"
          hx-get="/app/delivery/providers"
          hx-target="#app-content"
          hx-push-url="/app/delivery"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Providers
        </a>
        <span class="text-gray-400">/</span>
        <span class="text-sm text-gray-900">{title}</span>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

      <form
        hx-post={isEdit ? undefined : submitUrl}
        hx-patch={isEdit ? submitUrl : undefined}
        hx-target="#app-content"
        hx-swap="innerHTML"
        hx-ext="json-enc"
        class="max-w-2xl"
      >
        <div class="space-y-6">
          {/* Channel */}
          <div>
            <label
              for="channel"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Channel
            </label>
            <select
              id="channel"
              name="channel"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="email" selected={provider?.channel === 'email'}>
                Email
              </option>
              <option value="sms" selected={provider?.channel === 'sms'}>
                SMS
              </option>
              <option value="push" selected={provider?.channel === 'push'}>
                Push
              </option>
              <option
                value="webhook"
                selected={provider?.channel === 'webhook'}
              >
                Webhook
              </option>
            </select>
          </div>

          {/* Provider type */}
          <div>
            <label
              for="providerType"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Provider
            </label>
            <select
              id="providerType"
              name="providerType"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option
                value="ses"
                selected={provider?.provider_type === 'ses'}
              >
                Amazon SES
              </option>
              <option
                value="sendgrid"
                selected={provider?.provider_type === 'sendgrid'}
              >
                SendGrid
              </option>
              <option
                value="postmark"
                selected={provider?.provider_type === 'postmark'}
              >
                Postmark
              </option>
              <option
                value="twilio"
                selected={provider?.provider_type === 'twilio'}
              >
                Twilio
              </option>
              <option
                value="custom_smtp"
                selected={provider?.provider_type === 'custom_smtp'}
              >
                Custom SMTP
              </option>
            </select>
          </div>

          {/* Priority + Active */}
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                for="priority"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Priority
              </label>
              <input
                id="priority"
                name="priority"
                type="number"
                min="0"
                value={String(provider?.priority ?? 0)}
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p class="mt-1 text-xs text-gray-400">
                Higher priority providers are used first.
              </p>
            </div>
            <div class="flex items-center gap-2 pt-6">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                checked={provider?.is_active ?? true}
                class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
              />
              <label for="isActive" class="text-sm font-medium text-gray-700">
                Active
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Add Provider'}
          </button>
          <button
            type="button"
            hx-get="/app/delivery/providers"
            hx-target="#app-content"
            hx-push-url="/app/delivery"
            class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
