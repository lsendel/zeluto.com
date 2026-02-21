import type { FC } from 'hono/jsx';

export interface AbTestFormProps {
  campaignId: string;
  errors?: Record<string, string>;
}

export const AbTestFormView: FC<AbTestFormProps> = ({
  campaignId,
  errors = {},
}) => {
  return (
    <div id="ab-test-form">
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
        <a
          href={`/app/campaigns/${campaignId}`}
          hx-get={`/app/campaign/campaigns/${campaignId}`}
          hx-target="#app-content"
          hx-push-url={`/app/campaigns/${campaignId}`}
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Campaign
        </a>
        <span class="text-gray-400">/</span>
        <span class="text-sm text-gray-900">New A/B Test</span>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-6">Create A/B Test</h1>

      <form
        hx-post={`/api/v1/campaign/campaigns/${campaignId}/ab-tests`}
        hx-target="#app-content"
        hx-swap="innerHTML"
        hx-ext="json-enc"
        class="max-w-2xl"
      >
        <div class="space-y-6">
          {/* Test name */}
          <div>
            <label
              for="name"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Test Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Subject line test"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Winning criteria */}
          <div>
            <label
              for="winningCriteria"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Winning Criteria
            </label>
            <select
              id="winningCriteria"
              name="winningCriteria"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="open_rate">Open Rate</option>
              <option value="click_rate">Click Rate</option>
              <option value="conversion_rate">Conversion Rate</option>
            </select>
          </div>

          {/* Test percentage */}
          <div>
            <label
              for="testPercentage"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Test Percentage
            </label>
            <input
              id="testPercentage"
              name="testPercentage"
              type="number"
              min="10"
              max="50"
              value="20"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p class="mt-1 text-xs text-gray-400">
              Percentage of the audience used for testing (10-50%).
            </p>
          </div>

          {/* Variant A */}
          <div class="rounded-lg border border-gray-200 p-4">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">Variant A</h3>
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600">
                  Subject Line
                </label>
                <input
                  name="variantASubject"
                  type="text"
                  placeholder="Subject for variant A"
                  class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Variant B */}
          <div class="rounded-lg border border-gray-200 p-4">
            <h3 class="text-sm font-semibold text-gray-900 mb-3">Variant B</h3>
            <div class="space-y-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-gray-600">
                  Subject Line
                </label>
                <input
                  name="variantBSubject"
                  type="text"
                  placeholder="Subject for variant B"
                  class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            Create A/B Test
          </button>
          <button
            type="button"
            hx-get={`/app/campaign/campaigns/${campaignId}`}
            hx-target="#app-content"
            hx-push-url={`/app/campaigns/${campaignId}`}
            class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
