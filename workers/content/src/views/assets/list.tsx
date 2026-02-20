import type { FC } from 'hono/jsx';
import type { AssetRow } from '../../infrastructure/repositories/asset-repository.js';

export interface AssetListProps {
  assets: AssetRow[];
  total: number;
  page: number;
  limit: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AssetListView: FC<AssetListProps> = ({
  assets,
  total,
  page,
  limit,
}) => {
  const totalPages = Math.ceil(total / limit);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div id="asset-list">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Assets</h1>
          <p class="mt-1 text-sm text-gray-500">{total} total assets</p>
        </div>
        <button
          hx-get="/app/content/assets/upload"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + Upload Asset
        </button>
      </div>

      <div class="overflow-hidden rounded-lg border border-gray-200">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Name
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Type
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Size
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Folder
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              {assets.length === 0 ? (
                <tr>
                  <td
                    colspan={5}
                    class="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No assets found. Upload your first asset to get started.
                  </td>
                </tr>
              ) : (
                assets.map((a) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">
                      {a.name}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                        {a.mimeType}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {formatFileSize(Number(a.sizeBytes))}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {a.folder ?? '-'}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 space-x-2">
                      <a
                        href={`/api/v1/content/assets/${a.id}/download`}
                        class="text-brand-600 hover:text-brand-800"
                      >
                        Download
                      </a>
                      <button
                        hx-delete={`/api/v1/content/assets/${a.id}`}
                        hx-confirm="Are you sure you want to delete this asset?"
                        hx-target="#app-content"
                        hx-swap="innerHTML"
                        class="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <nav class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between gap-1 sm:justify-end">
              {hasPrev ? (
                <a
                  href={`/app/content/assets?page=${page - 1}`}
                  hx-get={`/app/content/assets?page=${page - 1}`}
                  hx-target="#app-content"
                  hx-push-url="true"
                  class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </a>
              ) : null}
              {hasNext ? (
                <a
                  href={`/app/content/assets?page=${page + 1}`}
                  hx-get={`/app/content/assets?page=${page + 1}`}
                  hx-target="#app-content"
                  hx-push-url="true"
                  class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Next
                </a>
              ) : null}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};
