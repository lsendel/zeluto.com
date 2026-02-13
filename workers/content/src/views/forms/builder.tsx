import type { FC } from 'hono/jsx';
import type { FormRow } from '../../infrastructure/repositories/form-repository.js';

export interface FormBuilderProps {
  form?: FormRow | null;
  errors?: Record<string, string>;
}

interface FormFieldDef {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  order?: number;
}

export const FormBuilderView: FC<FormBuilderProps> = ({
  form,
  errors = {},
}) => {
  const isEdit = !!form;
  const title = isEdit ? 'Edit Form' : 'New Form';
  const submitUrl = isEdit
    ? `/api/v1/content/forms/${form!.id}`
    : '/api/v1/content/forms';
  const fields = (form?.fields ?? []) as FormFieldDef[];

  return (
    <div id="form-builder">
      <div class="flex items-center gap-2 mb-6">
        <a
          href="/app/content/forms"
          hx-get="/app/content/forms"
          hx-target="#app-content"
          hx-push-url="true"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Forms
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
                Form Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={form?.name ?? ''}
                placeholder="My Form"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div>
              <label for="description" class="mb-1 block text-sm font-medium text-gray-700">
                Description
              </label>
              <input
                id="description"
                name="description"
                type="text"
                value={form?.description ?? ''}
                placeholder="Optional description"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {/* Form Fields section */}
          <div class="border border-gray-200 rounded-lg p-4">
            <h3 class="text-lg font-medium text-gray-900 mb-4">Form Fields</h3>
            <p class="text-sm text-gray-500 mb-4">
              Add fields to your form. Drag to reorder.
            </p>

            <div id="field-list" class="space-y-3">
              {fields.length === 0 ? (
                <div class="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  No fields added yet. Click "Add Field" below.
                </div>
              ) : (
                fields.map((field, index) => (
                  <div
                    class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    draggable="true"
                    data-field-index={index}
                  >
                    <div class="cursor-move text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                    </div>
                    <div class="flex-1 grid grid-cols-3 gap-2">
                      <span class="text-sm font-medium text-gray-900">{field.label}</span>
                      <span class="text-sm text-gray-500">{field.type}</span>
                      <span class="text-sm text-gray-500">
                        {field.required ? 'Required' : 'Optional'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add field button */}
            <div class="mt-4">
              <button
                type="button"
                class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                onclick="document.getElementById('add-field-panel').classList.toggle('hidden')"
              >
                + Add Field
              </button>
            </div>

            {/* Add field panel */}
            <div id="add-field-panel" class="hidden mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div class="grid grid-cols-2 gap-3">
                {['text', 'email', 'tel', 'number', 'textarea', 'select', 'checkbox', 'date'].map((type) => (
                  <button
                    type="button"
                    class="flex items-center gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:border-brand-500 hover:bg-brand-50 text-sm text-gray-700 transition-colors"
                  >
                    <span class="font-medium capitalize">{type}</span>
                    <span class="text-gray-400">field</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Redirect URL */}
          <div>
            <label for="redirectUrl" class="mb-1 block text-sm font-medium text-gray-700">
              Redirect URL (after submission)
            </label>
            <input
              id="redirectUrl"
              name="redirectUrl"
              type="url"
              value={form?.redirectUrl ?? ''}
              placeholder="https://example.com/thank-you"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Create Form'}
          </button>
          <button
            type="button"
            hx-get="/app/content/forms"
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
