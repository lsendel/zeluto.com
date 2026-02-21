import type { FC } from 'hono/jsx';

export interface OrgGeneralProps {
  org: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    createdAt: Date;
  };
  errors?: Record<string, string>;
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const OrgGeneralView: FC<OrgGeneralProps> = ({ org, errors = {} }) => {
  return (
    <div id="settings-general">
      {/* Settings navigation tabs */}
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-4">Settings</h1>
        <div class="border-b border-gray-200">
          <nav class="-mb-px flex gap-6" aria-label="Settings tabs">
            <a
              href="/app/settings/general"
              hx-get="/app/settings/general"
              hx-target="#app-content"
              hx-push-url="true"
              class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
            >
              General
            </a>
            <a
              href="/app/settings/members"
              hx-get="/app/settings/members"
              hx-target="#app-content"
              hx-push-url="true"
              class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              Members
            </a>
            <a
              href="/app/settings/invites"
              hx-get="/app/settings/invites"
              hx-target="#app-content"
              hx-push-url="true"
              class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              Invites
            </a>
          </nav>
        </div>
      </div>

      {/* Organization info card */}
      <div class="max-w-2xl">
        <div class="rounded-lg border border-gray-200 bg-white p-6 mb-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">
            Organization Info
          </h3>
          <dl class="space-y-3">
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Organization ID</dt>
              <dd class="text-sm text-gray-900 font-mono text-xs">{org.id}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-sm text-gray-500">Created</dt>
              <dd class="text-sm text-gray-900">{formatDate(org.createdAt)}</dd>
            </div>
          </dl>
        </div>

        {/* Edit form */}
        <form
          hx-patch={`/api/v1/identity/organizations/${org.id}`}
          hx-target="#app-content"
          hx-swap="innerHTML"
          hx-ext="json-enc"
          class="rounded-lg border border-gray-200 bg-white p-6"
        >
          <h3 class="text-sm font-semibold text-gray-900 mb-4">
            Edit Organization
          </h3>
          <div class="space-y-4">
            <div>
              <label
                for="name"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Organization Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={org.name}
                required
                class={`block w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-0 ${
                  errors.name
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:border-brand-500 focus:ring-brand-500'
                }`}
              />
              {errors.name && (
                <p class="mt-1 text-sm text-red-600" role="alert">
                  {errors.name}
                </p>
              )}
            </div>
            <div>
              <label
                for="slug"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Slug
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                value={org.slug}
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div class="mt-6">
            <button
              type="submit"
              class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
