import type { FC } from '@mauntic/ui-kit';
import { Button, Input } from '@mauntic/ui-kit';
import { OnboardingLayout } from './layout';

type CreateOrgViewProps = {
  assetsBaseUrl?: string;
};

export const CreateOrgView: FC<CreateOrgViewProps> = ({ assetsBaseUrl }) => {
  return (
    <OnboardingLayout
      title="Create Organization"
      currentStep={2}
      assetsBaseUrl={assetsBaseUrl}
    >
      <div class="rounded-xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
        {/* Heading */}
        <div class="mb-8 text-center">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            Create your organization
          </h1>
          <p class="mt-2 text-sm text-gray-600">
            Set up your workspace to get started
          </p>
        </div>

        {/* Error message */}
        <div
          id="create-org-error"
          class="hidden mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        ></div>

        {/* Form */}
        <form
          hx-post="/api/v1/onboarding/create-org"
          hx-swap="none"
          hx-indicator=".loading"
          hx-on--after-request="if(!event.detail.successful){document.getElementById('create-org-error').textContent='Failed to create organization. Please try again.';document.getElementById('create-org-error').classList.remove('hidden')}else{window.location.href='/app/onboarding/plan'}"
        >
          <div class="space-y-5">
            <Input
              name="name"
              label="Organization name"
              type="text"
              placeholder="Acme Corp"
              required
              hint="This will be visible to your team members"
              hx-trigger="keyup changed delay:500ms"
              hx-get="/api/v1/onboarding/generate-slug"
              hx-target="#slug-input"
              hx-swap="outerHTML"
            />

            <div id="slug-input">
              <Input
                name="slug"
                label="Organization slug"
                type="text"
                placeholder="acme-corp"
                hint="Used in your organization URL"
                required
              />
            </div>

            <div class="pt-2">
              <Button
                type="submit"
                class="w-full justify-center"
                variant="primary"
              >
                <span class="loading htmx-indicator">
                  <svg
                    class="animate-spin h-5 w-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                </span>
                Continue
              </Button>
            </div>
          </div>
        </form>
      </div>
    </OnboardingLayout>
  );
};
