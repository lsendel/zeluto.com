import type { Campaign } from '@mauntic/campaign-domain';
import type { FC } from 'hono/jsx';
import type { AbTestRow } from '../../infrastructure/repositories/ab-test-repository.js';
import type { CampaignStatsRow } from '../../infrastructure/repositories/campaign-repository.js';

export interface CampaignDetailProps {
  campaign: Campaign;
  stats: CampaignStatsRow | null;
  abTests: AbTestRow[];
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

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-700' },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-700' },
  sending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  sent: { bg: 'bg-green-100', text: 'text-green-700' },
  paused: { bg: 'bg-orange-100', text: 'text-orange-700' },
  canceled: { bg: 'bg-red-100', text: 'text-red-700' },
};

const StatCard: FC<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div class="rounded-lg border border-gray-200 bg-white p-4">
    <p class="text-sm text-gray-500">{label}</p>
    <p class="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
    {sub && <p class="mt-0.5 text-xs text-gray-400">{sub}</p>}
  </div>
);

export const CampaignDetailView: FC<CampaignDetailProps> = ({
  campaign,
  stats,
  abTests,
}) => {
  const colors = statusColors[campaign.status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
  };

  const canPause = campaign.status === 'sending';
  const canResume = campaign.status === 'paused';
  const canCancel = ['draft', 'scheduled', 'sending', 'paused'].includes(
    campaign.status,
  );

  return (
    <div id="campaign-detail">
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
        <span class="text-sm text-gray-900">{campaign.name}</span>
      </div>

      {/* Header */}
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <span
              class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
            >
              {campaign.status}
            </span>
          </div>
          {campaign.description && (
            <p class="mt-1 text-sm text-gray-500">{campaign.description}</p>
          )}
          {campaign.subject && (
            <p class="mt-1 text-sm text-gray-600">
              Subject: <span class="font-medium">{campaign.subject}</span>
            </p>
          )}
        </div>
        <div class="flex items-center gap-2">
          {campaign.status === 'draft' && (
            <a
              href={`/app/campaigns/${campaign.id}/edit`}
              hx-get={`/app/campaign/campaigns/${campaign.id}/edit`}
              hx-target="#app-content"
              hx-push-url={`/app/campaigns/${campaign.id}/edit`}
              class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Edit
            </a>
          )}
          {canPause && (
            <button
              hx-post={`/api/v1/campaign/campaigns/${campaign.id}/pause`}
              hx-target="#app-content"
              class="inline-flex items-center rounded-lg border border-orange-300 bg-white px-4 py-2 text-sm font-medium text-orange-700 shadow-sm hover:bg-orange-50"
            >
              Pause
            </button>
          )}
          {canResume && (
            <button
              hx-post={`/api/v1/campaign/campaigns/${campaign.id}/resume`}
              hx-target="#app-content"
              class="inline-flex items-center rounded-lg border border-green-300 bg-white px-4 py-2 text-sm font-medium text-green-700 shadow-sm hover:bg-green-50"
            >
              Resume
            </button>
          )}
          {canCancel && (
            <button
              hx-post={`/api/v1/campaign/campaigns/${campaign.id}/cancel`}
              hx-confirm="Are you sure you want to cancel this campaign?"
              hx-target="#app-content"
              class="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div class="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
        <StatCard
          label="Recipients"
          value={formatNumber(stats?.totalRecipients ?? campaign.recipientCount)}
        />
        <StatCard
          label="Delivered"
          value={formatNumber(stats?.delivered ?? campaign.deliveredCount)}
          sub={
            campaign.sentCount > 0
              ? `${formatRate(
                  (stats?.delivered ?? campaign.deliveredCount) /
                    campaign.sentCount,
                )} delivery rate`
              : undefined
          }
        />
        <StatCard
          label="Opened"
          value={formatNumber(stats?.opened ?? campaign.openCount)}
          sub={campaign.sentCount > 0 ? formatRate(campaign.openRate) : '-'}
        />
        <StatCard
          label="Clicked"
          value={formatNumber(stats?.clicked ?? campaign.clickCount)}
          sub={campaign.sentCount > 0 ? formatRate(campaign.clickRate) : '-'}
        />
      </div>

      {/* Details grid */}
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        {/* Campaign info */}
        <div class="rounded-lg border border-gray-200 bg-white p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">
            Campaign Details
          </h3>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Type</dt>
              <dd class="text-sm text-gray-900 capitalize">{campaign.type}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Created</dt>
              <dd class="text-sm text-gray-900">
                {formatDate(campaign.createdAt)}
              </dd>
            </div>
            {campaign.scheduledAt && (
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">Scheduled</dt>
                <dd class="text-sm text-gray-900">
                  {formatDate(campaign.scheduledAt)}
                </dd>
              </div>
            )}
            {campaign.startedAt && (
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">Started</dt>
                <dd class="text-sm text-gray-900">
                  {formatDate(campaign.startedAt)}
                </dd>
              </div>
            )}
            {campaign.completedAt && (
              <div class="flex justify-between">
                <dt class="text-sm text-gray-500">Completed</dt>
                <dd class="text-sm text-gray-900">
                  {formatDate(campaign.completedAt)}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Delivery metrics */}
        <div class="rounded-lg border border-gray-200 bg-white p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">
            Delivery Metrics
          </h3>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Sent</dt>
              <dd class="text-sm text-gray-900">
                {formatNumber(stats?.sent ?? campaign.sentCount)}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Bounced</dt>
              <dd class="text-sm text-gray-900">
                {formatNumber(stats?.bounced ?? campaign.bounceCount)}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Complaints</dt>
              <dd class="text-sm text-gray-900">
                {formatNumber(stats?.complained ?? campaign.complaintCount)}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Unsubscribed</dt>
              <dd class="text-sm text-gray-900">
                {formatNumber(stats?.unsubscribed ?? campaign.unsubscribeCount)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* A/B Tests */}
      {abTests.length > 0 && (
        <div class="rounded-lg border border-gray-200 bg-white p-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">A/B Tests</h3>
          <div class="space-y-3">
            {abTests.map((test) => (
              <a
                href={`/app/campaigns/${campaign.id}/ab/${test.id}`}
                hx-get={`/app/campaign/campaigns/${campaign.id}/ab/${test.id}`}
                hx-target="#app-content"
                hx-push-url={`/app/campaigns/${campaign.id}/ab/${test.id}`}
                class="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p class="text-sm font-medium text-gray-900">{test.name}</p>
                  <p class="text-xs text-gray-500">
                    {test.testPercentage}% test split
                  </p>
                </div>
                <span
                  class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    test.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : test.status === 'running'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {test.status}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
