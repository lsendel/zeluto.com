import type { FC } from 'hono/jsx';
import type { TemplateRow } from '../../infrastructure/repositories/template-repository.js';

export interface TemplateListProps {
  templates: TemplateRow[];
  total: number;
  page: number;
  limit: number;
}

const Pagination: FC<{
  total: number;
  page: number;
  limit: number;
  basePath: string;
}> = ({ total, page, limit, basePath }) => {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav
      class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
      aria-label="Pagination"
    >
      <div class="hidden sm:block">
        <p class="text-sm text-gray-700">
          Showing page <span class="font-medium">{page}</span> of{' '}
          <span class="font-medium">{totalPages}</span>{' '}
          <span class="text-gray-500">({total} templates)</span>
        </p>
      </div>
      <div class="flex flex-1 justify-between gap-1 sm:justify-end">
        {hasPrev ? (
          <a
            href={`${basePath}?page=${page - 1}`}
            hx-get={`${basePath}?page=${page - 1}`}
            hx-target="#app-content"
            hx-push-url="true"
            class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Previous
          </a>
        ) : (
          <span class="relative inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
            Previous
          </span>
        )}
        {hasNext ? (
          <a
            href={`${basePath}?page=${page + 1}`}
            hx-get={`${basePath}?page=${page + 1}`}
            hx-target="#app-content"
            hx-push-url="true"
            class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Next
          </a>
        ) : (
          <span class="relative inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
            Next
          </span>
        )}
      </div>
    </nav>
  );
};

export const TemplateListView: FC<TemplateListProps> = ({
  templates,
  total,
  page,
  limit,
}) => {
  return (
    <div id="template-list">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Templates</h1>
          <p class="mt-1 text-sm text-gray-500">{total} total templates</p>
        </div>
        <button
          hx-get="/app/content/templates/new"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + New Template
        </button>
      </div>

      <div class="mb-4">
        <input
          type="search"
          name="search"
          placeholder="Search templates..."
          class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          hx-get="/app/content/templates"
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
                  Type
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Category
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              {templates.length === 0 ? (
                <tr>
                  <td
                    colspan={5}
                    class="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No templates found. Create your first template to get
                    started.
                  </td>
                </tr>
              ) : (
                templates.map((t) => (
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm font-medium text-gray-900">
                      <a
                        href={`/app/content/templates/${t.id}`}
                        hx-get={`/app/content/templates/${t.id}/edit`}
                        hx-target="#app-content"
                        hx-push-url="true"
                        class="hover:text-brand-600"
                      >
                        {t.name}
                      </a>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      <span class="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                        {t.type}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      {t.category ?? '-'}
                    </td>
                    <td class="px-6 py-4 text-sm">
                      <span
                        class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          t.isActive
                            ? 'bg-green-50 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500">
                      <button
                        hx-delete={`/api/v1/content/templates/${t.id}`}
                        hx-confirm="Are you sure you want to delete this template?"
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
        <Pagination
          total={total}
          page={page}
          limit={limit}
          basePath="/app/content/templates"
        />
      </div>
    </div>
  );
};
