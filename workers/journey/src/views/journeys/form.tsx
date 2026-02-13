import type { FC } from 'hono/jsx';
import type { JourneyRow } from '../../infrastructure/repositories/journey-repository.js';

export interface JourneyFormProps {
  journey?: JourneyRow | null;
  errors?: Record<string, string>;
}

export const JourneyFormView: FC<JourneyFormProps> = ({
  journey,
  errors = {},
}) => {
  const isEdit = !!journey;
  const title = isEdit ? 'Edit Journey' : 'New Journey';
  const submitUrl = isEdit
    ? `/api/v1/journey/journeys/${journey!.id}`
    : '/api/v1/journey/journeys';

  return (
    <div id="journey-form">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 mb-6">
        <a
          href="/app/journey/journeys"
          hx-get="/app/journey/journeys"
          hx-target="#app-content"
          hx-push-url="true"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Journeys
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
        class="max-w-2xl"
      >
        <div class="space-y-6">
          {/* Name */}
          <div>
            <label for="name" class="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={journey?.name ?? ''}
              placeholder="My Journey"
              required
              class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.name
                  ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500'
              }`}
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && (
              <p id="name-error" class="mt-1 text-sm text-red-600" role="alert">
                {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label for="description" class="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              placeholder="Describe the purpose of this journey..."
              class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.description
                  ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500'
              }`}
            >
              {journey?.description ?? ''}
            </textarea>
            {errors.description && (
              <p class="mt-1 text-sm text-red-600" role="alert">
                {errors.description}
              </p>
            )}
          </div>
        </div>

        {/* Form actions */}
        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Create Journey'}
          </button>
          <button
            type="button"
            hx-get={isEdit ? `/app/journey/journeys/${journey!.id}` : '/app/journey/journeys'}
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
