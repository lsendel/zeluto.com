import type { FC } from 'hono/jsx';
import type { LandingPageRow } from '../../infrastructure/repositories/landing-page-repository.js';

export interface PageEditorProps {
  page?: LandingPageRow | null;
  errors?: Record<string, string>;
}

export const PageEditorView: FC<PageEditorProps> = ({ page, errors = {} }) => {
  const isEdit = !!page;
  const title = isEdit ? 'Edit Landing Page' : 'New Landing Page';
  const submitUrl = isEdit
    ? `/api/v1/content/landing-pages/${page?.id}`
    : '/api/v1/content/landing-pages';

  return (
    <div id="page-editor">
      <div class="flex items-center gap-2 mb-6">
        <a
          href="/app/content/pages"
          hx-get="/app/content/pages"
          hx-target="#app-content"
          hx-push-url="true"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Landing Pages
        </a>
        <span class="text-gray-400">/</span>
        <span class="text-sm text-gray-900">{title}</span>
      </div>

      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-gray-900">{title}</h1>
        {isEdit && (
          <div class="flex items-center gap-2">
            <span
              class={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                page?.isPublished
                  ? 'bg-green-50 text-green-700'
                  : 'bg-yellow-50 text-yellow-700'
              }`}
            >
              {page?.isPublished ? 'Published' : 'Draft'}
            </span>
            {page?.isPublished ? (
              <button
                hx-post={`/api/v1/content/landing-pages/${page?.id}/unpublish`}
                hx-target="#app-content"
                class="inline-flex items-center rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-100"
              >
                Unpublish
              </button>
            ) : (
              <button
                hx-post={`/api/v1/content/landing-pages/${page?.id}/publish`}
                hx-target="#app-content"
                class="inline-flex items-center rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Publish
              </button>
            )}
          </div>
        )}
      </div>

      <form
        hx-post={isEdit ? undefined : submitUrl}
        hx-patch={isEdit ? submitUrl : undefined}
        hx-target="#app-content"
        hx-swap="innerHTML"
        hx-ext="json-enc"
        class="max-w-4xl"
      >
        <div class="space-y-6">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                for="name"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Page Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={page?.name ?? ''}
                placeholder="My Landing Page"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label
                for="slug"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                URL Slug
              </label>
              <div class="flex items-center">
                <span class="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  /p/
                </span>
                <input
                  id="slug"
                  name="slug"
                  type="text"
                  value={page?.slug ?? ''}
                  placeholder="my-page"
                  class="block w-full rounded-r-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
            </div>
          </div>

          {isEdit && (
            <div class="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p class="text-xs text-gray-500 uppercase tracking-wider">
                  Visits
                </p>
                <p class="text-lg font-semibold text-gray-900">
                  {page?.visitCount}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500 uppercase tracking-wider">
                  Conversions
                </p>
                <p class="text-lg font-semibold text-gray-900">
                  {page?.conversionCount}
                </p>
              </div>
              <div>
                <p class="text-xs text-gray-500 uppercase tracking-wider">
                  Conversion Rate
                </p>
                <p class="text-lg font-semibold text-gray-900">
                  {page?.visitCount > 0
                    ? `${((page?.conversionCount / page?.visitCount) * 100).toFixed(1)}%`
                    : '0%'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Create Page'}
          </button>
          <button
            type="button"
            hx-get="/app/content/pages"
            hx-target="#app-content"
            hx-push-url="true"
            class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
