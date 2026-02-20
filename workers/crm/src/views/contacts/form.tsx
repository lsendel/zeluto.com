import type { FC } from 'hono/jsx';
import type { ContactRow } from '../../infrastructure/repositories/contact-repository.js';

export interface ContactFormProps {
  /** Existing contact for edit mode; undefined for create mode */
  contact?: ContactRow | null;
  /** Validation errors keyed by field name */
  errors?: Record<string, string>;
}

export const ContactFormView: FC<ContactFormProps> = ({
  contact,
  errors = {},
}) => {
  const isEdit = !!contact;
  const title = isEdit ? 'Edit Contact' : 'New Contact';
  const submitUrl = isEdit
    ? `/api/v1/crm/contacts/${contact?.id}`
    : '/api/v1/crm/contacts';

  return (
    <div id="contact-form">
      {/* Breadcrumb */}
      <div class="flex items-center gap-2 mb-6">
        <a
          href="/app/crm/contacts"
          hx-get="/app/crm/contacts"
          hx-target="#app-content"
          hx-push-url="true"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Contacts
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
          {/* Email */}
          <div>
            <label
              for="email"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={contact?.email ?? ''}
              placeholder="contact@example.com"
              class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.email
                  ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500'
              }`}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && (
              <p
                id="email-error"
                class="mt-1 text-sm text-red-600"
                role="alert"
              >
                {errors.email}
              </p>
            )}
          </div>

          {/* Name fields */}
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                for="firstName"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                First Name
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                value={contact?.first_name ?? ''}
                placeholder="John"
                class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  errors.firstName
                    ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500'
                }`}
              />
              {errors.firstName && (
                <p class="mt-1 text-sm text-red-600" role="alert">
                  {errors.firstName}
                </p>
              )}
            </div>
            <div>
              <label
                for="lastName"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Last Name
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                value={contact?.last_name ?? ''}
                placeholder="Doe"
                class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  errors.lastName
                    ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500'
                }`}
              />
              {errors.lastName && (
                <p class="mt-1 text-sm text-red-600" role="alert">
                  {errors.lastName}
                </p>
              )}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label
              for="phone"
              class="mb-1 block text-sm font-medium text-gray-700"
            >
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={contact?.phone ?? ''}
              placeholder="+1 (555) 123-4567"
              class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                errors.phone
                  ? 'border-red-300 text-red-900 focus:border-red-500 focus:ring-red-500'
                  : 'border-gray-300 text-gray-900 focus:border-brand-500 focus:ring-brand-500'
              }`}
            />
            {errors.phone && (
              <p class="mt-1 text-sm text-red-600" role="alert">
                {errors.phone}
              </p>
            )}
          </div>

          {/* Status (only on edit) */}
          {isEdit && (
            <div>
              <label
                for="status"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="active" selected={contact?.status === 'active'}>
                  Active
                </option>
                <option
                  value="unsubscribed"
                  selected={contact?.status === 'unsubscribed'}
                >
                  Unsubscribed
                </option>
                <option
                  value="bounced"
                  selected={contact?.status === 'bounced'}
                >
                  Bounced
                </option>
                <option
                  value="do_not_contact"
                  selected={contact?.status === 'do_not_contact'}
                >
                  Do Not Contact
                </option>
              </select>
            </div>
          )}
        </div>

        {/* Form actions */}
        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            {isEdit ? 'Save Changes' : 'Create Contact'}
          </button>
          <button
            type="button"
            hx-get={
              isEdit ? `/app/crm/contacts/${contact?.id}` : '/app/crm/contacts'
            }
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
