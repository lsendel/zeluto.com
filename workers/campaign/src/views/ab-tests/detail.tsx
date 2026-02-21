import type { FC } from 'hono/jsx';
import type { AbTestRow } from '../../infrastructure/repositories/ab-test-repository.js';

export interface AbTestDetailProps {
  abTest: AbTestRow;
  campaignId: string;
}

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

interface Variant {
  id?: string;
  name?: string;
  subject?: string;
  templateId?: string;
  percentage?: number;
}

export const AbTestDetailView: FC<AbTestDetailProps> = ({
  abTest,
  campaignId,
}) => {
  const variants = (abTest.variants ?? []) as Variant[];

  return (
    <div id="ab-test-detail">
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
        <span class="text-sm text-gray-900">A/B Test</span>
      </div>

      {/* Header */}
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-gray-900">{abTest.name}</h1>
            <span
              class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                abTest.status === 'completed'
                  ? 'bg-green-100 text-green-700'
                  : abTest.status === 'running'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
              }`}
            >
              {abTest.status}
            </span>
          </div>
          <p class="mt-1 text-sm text-gray-500">
            {abTest.testPercentage}% of audience used for testing
          </p>
        </div>
      </div>

      {/* Test info */}
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <div class="rounded-lg border border-gray-200 bg-white p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Test Details</h3>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Winning Criteria</dt>
              <dd class="text-sm text-gray-900 capitalize">
                {abTest.winningCriteria?.replace(/_/g, ' ') ?? '-'}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Started</dt>
              <dd class="text-sm text-gray-900">
                {formatDate(abTest.startedAt)}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Completed</dt>
              <dd class="text-sm text-gray-900">
                {formatDate(abTest.completedAt)}
              </dd>
            </div>
            {abTest.winnerVariantId && (
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">Winner</dt>
                <dd class="text-sm font-medium text-green-700">
                  {variants.find((v) => v.id === abTest.winnerVariantId)
                    ?.name ?? abTest.winnerVariantId}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Variants */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Variants</h3>
        {variants.length === 0 ? (
          <p class="text-sm text-gray-500">No variants configured.</p>
        ) : (
          <div class="space-y-3">
            {variants.map((variant) => {
              const isWinner = variant.id === abTest.winnerVariantId;
              return (
                <div
                  class={`rounded-lg border p-4 ${
                    isWinner
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-100'
                  }`}
                >
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-medium text-gray-900">
                        {variant.name ?? 'Unnamed Variant'}
                        {isWinner && (
                          <span class="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Winner
                          </span>
                        )}
                      </p>
                      {variant.subject && (
                        <p class="mt-0.5 text-xs text-gray-500">
                          Subject: {variant.subject}
                        </p>
                      )}
                    </div>
                    {variant.percentage != null && (
                      <span class="text-sm text-gray-500">
                        {variant.percentage}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
