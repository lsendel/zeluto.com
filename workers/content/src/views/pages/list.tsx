import type { FC } from 'hono/jsx';
import type { LandingPageRow } from '../../infrastructure/repositories/landing-page-repository.js';

export interface PageListProps {
  pages: LandingPageRow[];
  total: number;
  page: number;
  limit: number;
}

export const PageListView: FC<PageListProps> = ({
  pages,
  total,
  page,
  limit,
}) => {
  const totalPages = Math.ceil(total / limit);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div id="page-list">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Landing Pages</h1>
          <p class="mt-1 text-sm text-gray-500">{total} total pages</p>
        </div>
        <button
          hx-get="/app/content/pages/new"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + New Page
        </button>
      </div>

      <div class="mb-4">
        <input
          type="search"
          name="search"
          placeholder="Search landing pages..."
          class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          hx-get="/app/content/pages"
          hx-target="#app-content"
          hx-trigger="keyup changed delay:300ms"
          hx-push-url="true"
          hx-include="this"
        />
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
                  Slug
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Status
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Visits
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
              {pages.length === 0 ? (
                <tr>
                  <td
                    colspan={5}
                    class="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No landing pages found. Create your first page to get
                    started.
                  </td>
                </tr>
              ) : (
                pages.map((p) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">
                      <a
                        href={`/app/content/pages/${p.id}`}
                        hx-get={`/app/content/pages/${p.id}/edit`}
                        hx-target="#app-content"
                        hx-push-url="true"
                        class="hover:text-brand-600"
                      >
                        {p.name}
                      </a>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      <code class="text-xs bg-gray-100 px-2 py-1 rounded">
                        /p/{p.slug}
                      </code>
                    </td>
                    <td class="px-6 py-4 text-sm">
                      <span
                        class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          p.isPublished
                            ? 'bg-green-50 text-green-700'
                            : 'bg-yellow-50 text-yellow-700'
                        }`}
                      >
                        {p.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {p.visitCount}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500 space-x-2">
                      {p.isPublished ? (
                        <button
                          hx-post={`/api/v1/content/landing-pages/${p.id}/unpublish`}
                          hx-target="#app-content"
                          class="text-yellow-600 hover:text-yellow-800"
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          hx-post={`/api/v1/content/landing-pages/${p.id}/publish`}
                          hx-target="#app-content"
                          class="text-green-600 hover:text-green-800"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        hx-delete={`/api/v1/content/landing-pages/${p.id}`}
                        hx-confirm="Are you sure you want to delete this page?"
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
                  href={`/app/content/pages?page=${page - 1}`}
                  hx-get={`/app/content/pages?page=${page - 1}`}
                  hx-target="#app-content"
                  hx-push-url="true"
                  class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </a>
              ) : null}
              {hasNext ? (
                <a
                  href={`/app/content/pages?page=${page + 1}`}
                  hx-get={`/app/content/pages?page=${page + 1}`}
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
