import type { FC } from 'hono/jsx';
import type { ContactRow } from '../../infrastructure/repositories/contact-repository.js';
import { ContactRowView } from './row.js';

export interface ContactListProps {
  contacts: ContactRow[];
  total: number;
  page: number;
  limit: number;
}

const Pagination: FC<{ total: number; page: number; limit: number }> = ({
  total,
  page,
  limit,
}) => {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Build visible page numbers
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('ellipsis');
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  return (
    <nav
      class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
      aria-label="Contact list pagination"
    >
      <div class="hidden sm:block">
        <p class="text-sm text-gray-700">
          Showing page <span class="font-medium">{page}</span> of{' '}
          <span class="font-medium">{totalPages}</span>{' '}
          <span class="text-gray-500">({total} contacts)</span>
        </p>
      </div>
      <div class="flex flex-1 justify-between gap-1 sm:justify-end">
        {hasPrev ? (
          <a
            href={`/app/crm/contacts?page=${page - 1}`}
            hx-get={`/app/crm/contacts?page=${page - 1}`}
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

        <div class="hidden items-center gap-1 sm:flex">
          {pages.map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} class="px-2 text-gray-400">
                ...
              </span>
            ) : (
              <a
                key={p}
                href={`/app/crm/contacts?page=${p}`}
                hx-get={`/app/crm/contacts?page=${p}`}
                hx-target="#app-content"
                hx-push-url="true"
                class={`relative inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ${
                  p === page
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </a>
            ),
          )}
        </div>

        {hasNext ? (
          <a
            href={`/app/crm/contacts?page=${page + 1}`}
            hx-get={`/app/crm/contacts?page=${page + 1}`}
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

export const ContactListView: FC<ContactListProps> = ({
  contacts,
  total,
  page,
  limit,
}) => {
  return (
    <div id="contact-list">
      {/* Header */}
      <div class="flex justify-between items-center mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Contacts</h1>
          <p class="mt-1 text-sm text-gray-500">{total} total contacts</p>
        </div>
        <button
          hx-get="/app/crm/contacts/new"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + New Contact
        </button>
      </div>

      {/* Search */}
      <div class="mb-4">
        <input
          type="search"
          name="search"
          placeholder="Search contacts by name or email..."
          class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
          hx-get="/app/crm/contacts"
          hx-target="#app-content"
          hx-trigger="keyup changed delay:300ms"
          hx-push-url="true"
          hx-include="this"
        />
      </div>

      {/* Table */}
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
                  Email
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
                  Last Activity
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody
              id="contact-table-body"
              class="divide-y divide-gray-200 bg-white"
            >
              {contacts.length === 0 ? (
                <tr>
                  <td
                    colspan={5}
                    class="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No contacts found. Create your first contact to get started.
                  </td>
                </tr>
              ) : (
                contacts.map((c) => <ContactRowView contact={c} />)
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination total={total} page={page} limit={limit} />
      </div>
    </div>
  );
};
