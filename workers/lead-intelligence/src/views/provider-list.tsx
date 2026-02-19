import type { FC } from 'hono/jsx';
import type { EnrichmentProviderRow } from '../infrastructure/repositories/enrichment-provider-repository.js';

export interface ProviderListProps {
  providers: EnrichmentProviderRow[];
}

export const ProviderListView: FC<ProviderListProps> = ({ providers }) => {
  return (
    <div id="provider-list">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Enrichment Providers</h1>
          <p class="mt-1 text-sm text-gray-500">{providers.length} configured providers</p>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {providers.length === 0 ? (
          <div class="col-span-full text-center py-12 text-sm text-gray-500">
            No enrichment providers configured. Add providers to start enriching contacts.
          </div>
        ) : (
          providers.map((p) => (
            <div class="rounded-lg border border-gray-200 bg-white p-4">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-gray-900">{p.name}</h3>
                <span
                  class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    p.status === 'active'
                      ? 'bg-green-50 text-green-700'
                      : p.status === 'error'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  {p.status}
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-500">Priority: {p.priority}</p>
              <p class="mt-1 text-xs text-gray-500">
                Cost: ${p.cost_per_lookup}/lookup
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
