import type { FC } from 'hono/jsx';
import type { ProspectRow } from '../infrastructure/repositories/prospect-repository.js';

export interface ProspectListProps {
  prospects: ProspectRow[];
}

const RecommendationBadge: FC<{ recommendation: string }> = ({ recommendation }) => {
  const colors: Record<string, string> = {
    sequence: 'bg-green-100 text-green-800',
    enrich: 'bg-blue-100 text-blue-800',
    skip: 'bg-gray-100 text-gray-800',
    manual_review: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[recommendation] ?? 'bg-gray-100 text-gray-800'}`}>
      {recommendation.replace(/_/g, ' ')}
    </span>
  );
};

export const ProspectListView: FC<ProspectListProps> = ({ prospects }) => {
  return (
    <div id="prospect-list">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Prospects</h1>
          <p class="mt-1 text-sm text-gray-500">{prospects.length} prospects</p>
        </div>
      </div>

      <div class="overflow-hidden rounded-lg border border-gray-200">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Contact</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Score</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">ICP Match</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Recommendation</th>
              <th class="px-6 py-3 text-left text-xs font-semibold uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            {prospects.length === 0 ? (
              <tr>
                <td colspan={5} class="px-6 py-12 text-center text-sm text-gray-500">
                  No prospects found.
                </td>
              </tr>
            ) : (
              prospects.map((p) => (
                <tr>
                  <td class="px-6 py-4 text-sm text-gray-900">{p.contact_id.slice(0, 8)}...</td>
                  <td class="px-6 py-4 text-sm font-medium text-gray-900">{p.qualification_score}</td>
                  <td class="px-6 py-4 text-sm text-gray-500">{Number(p.icp_match).toFixed(0)}%</td>
                  <td class="px-6 py-4"><RecommendationBadge recommendation={p.recommendation} /></td>
                  <td class="px-6 py-4">
                    <button
                      hx-post={`/api/v1/revops/prospects/${p.contact_id}/qualify`}
                      hx-target="#prospect-list"
                      hx-swap="outerHTML"
                      class="text-sm text-brand-600 hover:text-brand-800"
                    >
                      Re-qualify
                    </button>
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
