import type { Child, FC } from '../types.js';

export interface Column<T = Record<string, unknown>> {
  key: string;
  header: string;
  class?: string;
  render?: (row: T, index: number) => Child;
}

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  /** Base URL for pagination links (page param will be appended) */
  baseUrl: string;
  /** HTMX target for pagination */
  'hx-target'?: string;
  /** HTMX swap strategy */
  'hx-swap'?: string;
}

export interface TableProps<T = Record<string, unknown>> {
  columns: Column<T>[];
  rows: T[];
  /** Unique key field for each row */
  rowKey?: string;
  class?: string;
  /** Pagination configuration */
  pagination?: PaginationProps;
  /** Message when table is empty */
  emptyMessage?: string;
}

const Pagination: FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  baseUrl,
  'hx-target': hxTarget,
  'hx-swap': hxSwap = 'innerHTML',
}) => {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  const separator = baseUrl.includes('?') ? '&' : '?';
  const pageUrl = (page: number) => `${baseUrl}${separator}page=${page}`;

  // Build visible page numbers
  const pages: (number | 'ellipsis')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('ellipsis');
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages);
  }

  const htmxAttrs: Record<string, string> = {};
  if (hxTarget) htmxAttrs['hx-target'] = hxTarget;
  if (hxSwap) htmxAttrs['hx-swap'] = hxSwap;

  return (
    <nav
      class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
      aria-label="Pagination"
    >
      <div class="hidden sm:block">
        <p class="text-sm text-gray-700">
          Showing page <span class="font-medium">{currentPage}</span> of{' '}
          <span class="font-medium">{totalPages}</span>{' '}
          <span class="text-gray-500">({totalItems} items)</span>
        </p>
      </div>
      <div class="flex flex-1 justify-between gap-1 sm:justify-end">
        {hasPrev ? (
          <a
            href={pageUrl(currentPage - 1)}
            class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            hx-get={pageUrl(currentPage - 1)}
            {...htmxAttrs}
          >
            Previous
          </a>
        ) : (
          <span class="relative inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
            Previous
          </span>
        )}

        <div class="hidden items-center gap-1 sm:flex">
          {pages.map((page, i) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${i}`} class="px-2 text-gray-400">
                ...
              </span>
            ) : (
              <a
                key={page}
                href={pageUrl(page)}
                hx-get={pageUrl(page)}
                class={`relative inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ${
                  page === currentPage
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                {...htmxAttrs}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </a>
            ),
          )}
        </div>

        {hasNext ? (
          <a
            href={pageUrl(currentPage + 1)}
            class="relative inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            hx-get={pageUrl(currentPage + 1)}
            {...htmxAttrs}
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

export const Table: FC<TableProps> = ({
  columns,
  rows,
  rowKey = 'id',
  class: className = '',
  pagination,
  emptyMessage = 'No data found.',
}) => {
  return (
    <div class={`overflow-hidden ${className}`}>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  class={`px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${col.class ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td
                  colspan={columns.length}
                  class="px-6 py-12 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={
                    ((row as Record<string, unknown>)[rowKey] as string) ??
                    index
                  }
                  class="hover:bg-gray-50 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      class={`whitespace-nowrap px-6 py-4 text-sm text-gray-900 ${col.class ?? ''}`}
                    >
                      {col.render
                        ? col.render(row, index)
                        : String(
                            (row as Record<string, unknown>)[col.key] ?? '',
                          )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && <Pagination {...pagination} />}
    </div>
  );
};
