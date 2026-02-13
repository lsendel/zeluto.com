import type { FC } from 'hono/jsx';
import type { TemplateRow } from '../../infrastructure/repositories/template-repository.js';

export interface TemplateFormProps {
  template?: TemplateRow | null;
  errors?: Record<string, string>;
}

export const TemplateFormView: FC<TemplateFormProps> = ({
  template,
  errors = {},
}) => {
  const isEdit = !!template;
  const title = isEdit ? 'Edit Template' : 'New Template';
  const submitUrl = isEdit
    ? `/api/v1/content/templates/${template!.id}`
    : '/api/v1/content/templates';

  return (
    <div id="template-form">
      <div class="flex items-center gap-2 mb-6">
        <a
          href="/app/content/templates"
          hx-get="/app/content/templates"
          hx-target="#app-content"
          hx-push-url="true"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Templates
        </a>
        <span class="text-gray-400">/</span>
        <span class="text-sm text-gray-900">{title}</span>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-6">{title}</h1>

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
              <label for="name" class="mb-1 block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={template?.name ?? ''}
                placeholder="Template name"
                class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  errors.name
                    ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500'
                }`}
                required
              />
            </div>
            {!isEdit && (
              <div>
                <label for="type" class="mb-1 block text-sm font-medium text-gray-700">
                  Type
                </label>
                <select
                  id="type"
                  name="type"
                  class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                  <option value="page">Page</option>
                </select>
              </div>
            )}
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label for="subject" class="mb-1 block text-sm font-medium text-gray-700">
                Subject
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={template?.subject ?? ''}
                placeholder="Email subject line"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label for="category" class="mb-1 block text-sm font-medium text-gray-700">
                Category
              </label>
              <input
                id="category"
                name="category"
                type="text"
                value={template?.category ?? ''}
                placeholder="e.g. Newsletters, Transactional"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label for="bodyHtml" class="mb-1 block text-sm font-medium text-gray-700">
              HTML Content
            </label>
            <textarea
              id="bodyHtml"
              name="bodyHtml"
              rows={12}
              placeholder="<html>...</html>"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {template?.bodyHtml ?? ''}
            </textarea>
          </div>

          <div>
            <label for="bodyText" class="mb-1 block text-sm font-medium text-gray-700">
              Plain Text Content
            </label>
            <textarea
              id="bodyText"
              name="bodyText"
              rows={6}
              placeholder="Plain text version..."
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {template?.bodyText ?? ''}
            </textarea>
          </div>
        </div>

        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Create Template'}
          </button>
          <button
            type="button"
            hx-get="/app/content/templates"
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
