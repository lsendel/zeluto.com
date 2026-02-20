import type { FC } from 'hono/jsx';
import type { FormRow } from '../../infrastructure/repositories/form-repository.js';

export interface FormListProps {
  forms: FormRow[];
  total: number;
  page: number;
  limit: number;
}

export const FormListView: FC<FormListProps> = ({
  forms,
  total,
  page,
  limit,
}) => {
  const totalPages = Math.ceil(total / limit);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div id="form-list">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Forms</h1>
          <p class="mt-1 text-sm text-gray-500">{total} total forms</p>
        </div>
        <button
          hx-get="/app/content/forms/new"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + New Form
        </button>
      </div>

      <div class="mb-4">
        <input
          type="search"
          name="search"
          placeholder="Search forms..."
          class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          hx-get="/app/content/forms"
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
                  Fields
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Submissions
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
              {forms.length === 0 ? (
                <tr>
                  <td
                    colspan={5}
                    class="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No forms found. Create your first form to get started.
                  </td>
                </tr>
              ) : (
                forms.map((f) => {
                  const fields = Array.isArray(f.fields) ? f.fields : [];
                  return (
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm font-medium text-gray-900">
                        <a
                          href={`/app/content/forms/${f.id}`}
                          hx-get={`/app/content/forms/${f.id}/edit`}
                          hx-target="#app-content"
                          hx-push-url="true"
                          class="hover:text-brand-600"
                        >
                          {f.name}
                        </a>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-500">
                        {fields.length} fields
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-500">
                        {f.submissionCount}
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <span
                          class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            f.isActive
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {f.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-500">
                        <button
                          hx-delete={`/api/v1/content/forms/${f.id}`}
                          hx-confirm="Are you sure you want to delete this form?"
                          hx-target="#app-content"
                          hx-swap="innerHTML"
                          class="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <nav class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
            <div class="flex flex-1 justify-between gap-1 sm:justify-end">
              {hasPrev ? (
                <a
                  href={`/app/content/forms?page=${page - 1}`}
                  hx-get={`/app/content/forms?page=${page - 1}`}
                  hx-target="#app-content"
                  hx-push-url="true"
                  class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </a>
              ) : null}
              {hasNext ? (
                <a
                  href={`/app/content/forms?page=${page + 1}`}
                  hx-get={`/app/content/forms?page=${page + 1}`}
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
