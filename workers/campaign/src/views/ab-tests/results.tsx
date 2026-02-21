import type { FC } from 'hono/jsx';
import type { AbTestRow } from '../../infrastructure/repositories/ab-test-repository.js';

export interface AbTestResultsProps {
  abTest: AbTestRow;
  campaignId: string;
}

interface Variant {
  id?: string;
  name?: string;
  subject?: string;
  percentage?: number;
  sent?: number;
  opens?: number;
  clicks?: number;
  openRate?: number;
  clickRate?: number;
}

function formatRate(rate: number | undefined): string {
  if (rate == null) return '-';
  return `${(rate * 100).toFixed(1)}%`;
}

export const AbTestResultsView: FC<AbTestResultsProps> = ({
  abTest,
  campaignId,
}) => {
  const variants = (abTest.variants ?? []) as Variant[];

  return (
    <div id="ab-test-results">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 mb-4">
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
        <span class="text-sm text-gray-900">A/B Test Results</span>
      </div>

      <div class="flex items-center gap-3 mb-6">
        <h1 class="text-2xl font-bold text-gray-900">{abTest.name}</h1>
        <span
          class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            abTest.status === 'completed'
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}
        >
          {abTest.status}
        </span>
      </div>

      {/* Variant comparison */}
      <div class="grid gap-4 md:grid-cols-2 mb-6">
        {variants.map((variant) => {
          const isWinner = variant.id === abTest.winnerVariantId;
          return (
            <div
              class={`rounded-lg border p-5 ${
                isWinner
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-semibold text-gray-900">
                  {variant.name ?? 'Unnamed'}
                </h3>
                {isWinner && (
                  <span class="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    Winner
                  </span>
                )}
              </div>
              {variant.subject && (
                <p class="text-xs text-gray-500 mb-3">
                  Subject: {variant.subject}
                </p>
              )}
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <p class="text-xs text-gray-400">Sent</p>
                  <p class="text-lg font-semibold text-gray-900">
                    {variant.sent?.toLocaleString() ?? '-'}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-400">Opens</p>
                  <p class="text-lg font-semibold text-gray-900">
                    {variant.opens?.toLocaleString() ?? '-'}
                  </p>
                  <p class="text-xs text-gray-400">
                    {formatRate(variant.openRate)}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-400">Clicks</p>
                  <p class="text-lg font-semibold text-gray-900">
                    {variant.clicks?.toLocaleString() ?? '-'}
                  </p>
                  <p class="text-xs text-gray-400">
                    {formatRate(variant.clickRate)}
                  </p>
                </div>
                <div>
                  <p class="text-xs text-gray-400">Split</p>
                  <p class="text-lg font-semibold text-gray-900">
                    {variant.percentage ?? '-'}%
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Select winner (if still running) */}
      {abTest.status !== 'completed' && !abTest.winnerVariantId && (
        <div class="rounded-lg border border-gray-200 bg-white p-4">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">
            Select Winner
          </h3>
          <div class="flex gap-2">
            {variants.map((variant) => (
              <button
                hx-post={`/api/v1/campaign/ab-tests/${abTest.id}/winner`}
                hx-vals={JSON.stringify({ winnerVariantId: variant.id })}
                hx-target="#app-content"
                hx-confirm={`Select "${variant.name}" as the winner?`}
                class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Pick {variant.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
