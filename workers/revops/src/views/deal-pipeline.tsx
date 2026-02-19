import type { FC } from 'hono/jsx';
import type { DealRow } from '../infrastructure/repositories/deal-repository.js';

const STAGES = [
  'prospecting',
  'qualification',
  'discovery',
  'proposal',
  'negotiation',
  'closed_won',
  'closed_lost',
] as const;

const STAGE_COLORS: Record<string, string> = {
  prospecting: 'bg-blue-50 border-blue-200',
  qualification: 'bg-indigo-50 border-indigo-200',
  discovery: 'bg-purple-50 border-purple-200',
  proposal: 'bg-yellow-50 border-yellow-200',
  negotiation: 'bg-orange-50 border-orange-200',
  closed_won: 'bg-green-50 border-green-200',
  closed_lost: 'bg-red-50 border-red-200',
};

export interface DealPipelineProps {
  deals: DealRow[];
  stageBreakdown: Record<string, { count: number; value: number }>;
}

export const DealPipelineView: FC<DealPipelineProps> = ({ deals, stageBreakdown }) => {
  const totalValue = Object.values(stageBreakdown).reduce((s, v) => s + v.value, 0);

  return (
    <div id="deal-pipeline">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Deal Pipeline</h1>
          <p class="mt-1 text-sm text-gray-500">
            {deals.length} deals | ${totalValue.toLocaleString()} total value
          </p>
        </div>
        <button
          hx-get="/app/revops/deals/new"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + New Deal
        </button>
      </div>

      <div class="grid grid-cols-7 gap-3 overflow-x-auto">
        {STAGES.filter((s) => s !== 'closed_lost').map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage);
          const stats = stageBreakdown[stage] ?? { count: 0, value: 0 };

          return (
            <div class={`rounded-lg border p-3 min-w-[180px] ${STAGE_COLORS[stage] ?? 'bg-gray-50 border-gray-200'}`}>
              <div class="mb-2">
                <h3 class="text-xs font-semibold uppercase text-gray-600">
                  {stage.replace(/_/g, ' ')}
                </h3>
                <p class="text-xs text-gray-500">
                  {stats.count} deals | ${stats.value.toLocaleString()}
                </p>
              </div>
              <div class="space-y-2">
                {stageDeals.slice(0, 5).map((deal) => (
                  <div
                    class="rounded border border-white bg-white p-2 shadow-sm cursor-pointer hover:shadow"
                    hx-get={`/app/revops/deals/${deal.id}`}
                    hx-target="#app-content"
                    hx-push-url="true"
                  >
                    <p class="text-sm font-medium text-gray-900 truncate">{deal.name}</p>
                    <p class="text-xs text-gray-500">${Number(deal.value).toLocaleString()}</p>
                  </div>
                ))}
                {stageDeals.length > 5 && (
                  <p class="text-xs text-gray-400 text-center">+{stageDeals.length - 5} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
