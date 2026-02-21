import type { Campaign } from '@mauntic/campaign-domain';
import type { FC } from 'hono/jsx';

export interface CampaignFormProps {
  campaign?: Campaign | null;
  errors?: Record<string, string>;
}

export const CampaignFormView: FC<CampaignFormProps> = ({
  campaign,
  errors = {},
}) => {
  const isEdit = !!campaign;
  const title = isEdit ? 'Edit Campaign' : 'New Campaign';
  const submitUrl = isEdit
    ? `/api/v1/campaign/campaigns/${campaign?.id}`
    : '/api/v1/campaign/campaigns';

  return (
    <div id="campaign-form">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 mb-6">
        <a
          href="/app/campaigns"
          hx-get="/app/campaign/campaigns"
          hx-target="#app-content"
          hx-push-url="/app/campaigns"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Campaigns
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
          {/* Name */}
          <div>
            <label
              for="name"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Campaign Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={campaign?.name ?? ''}
              placeholder="My Campaign"
              required
              class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.name
                  ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500'
              }`}
            />
            {errors.name && (
              <p class="mt-1 text-sm text-red-600" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label
              for="description"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Optional description..."
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {campaign?.description ?? ''}
            </textarea>
          </div>

          {/* Type + Subject */}
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                for="type"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Type
              </label>
              <select
                id="type"
                name="type"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="email" selected={campaign?.type === 'email'}>
                  Email
                </option>
                <option value="sms" selected={campaign?.type === 'sms'}>
                  SMS
                </option>
                <option value="push" selected={campaign?.type === 'push'}>
                  Push
                </option>
                <option
                  value="multichannel"
                  selected={campaign?.type === 'multichannel'}
                >
                  Multichannel
                </option>
              </select>
            </div>
            <div>
              <label
                for="subject"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Subject Line
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={campaign?.subject ?? ''}
                placeholder="Email subject line"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Template ID + Segment ID */}
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                for="templateId"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Template ID
              </label>
              <input
                id="templateId"
                name="templateId"
                type="text"
                value={campaign?.templateId ?? ''}
                placeholder="UUID of content template"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label
                for="segmentId"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Segment ID
              </label>
              <input
                id="segmentId"
                name="segmentId"
                type="text"
                value={campaign?.segmentId ?? ''}
                placeholder="UUID of contact segment"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Form actions */}
        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Create Campaign'}
          </button>
          <button
            type="button"
            hx-get={
              isEdit
                ? `/app/campaign/campaigns/${campaign?.id}`
                : '/app/campaign/campaigns'
            }
            hx-target="#app-content"
            hx-push-url={
              isEdit ? `/app/campaigns/${campaign?.id}` : '/app/campaigns'
            }
            class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
