import { OnboardingLayout } from "./layout";
import { Button, Input, Card } from "@mauntic/ui-kit";
import type { FC } from "@mauntic/ui-kit";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed?: boolean;
}

export interface SetupViewProps {
  currentSetupStep?: "domain" | "provider" | "contacts";
  domainVerified?: boolean;
  assetsBaseUrl?: string;
  isFragment?: boolean;
}

export const SetupView: FC<SetupViewProps> = ({
  currentSetupStep = "domain",
  domainVerified = false,
  assetsBaseUrl,
  isFragment = false,
}) => {
  const steps: SetupStep[] = [
    {
      id: "domain",
      title: "Add sending domain",
      description: "Configure your domain to send emails",
      completed: domainVerified,
    },
    {
      id: "provider",
      title: "Configure provider",
      description: "Connect your email delivery provider",
      completed: false,
    },
    {
      id: "contacts",
      title: "Import contacts",
      description: "Upload your contact list",
      completed: false,
    },
  ];

  const content = (
    <div>
      {/* Heading */}
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-bold tracking-tight text-gray-900">
          Set up your account
        </h1>
        <p class="mt-2 text-sm text-gray-600">
          Configure your workspace to start sending emails
        </p>
      </div>

      {/* Setup Steps */}
      <div class="space-y-4 mb-8">
        {steps.map((step, idx) => (
          <Card
            class={
              step.id === currentSetupStep
                ? "border-brand-500 ring-2 ring-brand-500"
                : ""
            }
          >
            <div class="flex items-start gap-4">
              <div
                class={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${step.completed
                    ? "bg-brand-600 text-white"
                    : step.id === currentSetupStep
                      ? "bg-brand-100 text-brand-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
              >
                {step.completed ? (
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <div class="flex-1">
                <h3 class="text-sm font-semibold text-gray-900">
                  {step.title}
                </h3>
                <p class="mt-1 text-sm text-gray-600">{step.description}</p>

                {/* Step Content */}
                {step.id === currentSetupStep && (
                  <div class="mt-4">
                    {step.id === "domain" && (
                      <DomainSetupForm verified={domainVerified} />
                    )}
                    {step.id === "provider" && <ProviderSetupForm />}
                    {step.id === "contacts" && <ContactsImportForm />}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Complete Setup */}
      <div class="flex justify-between items-center pt-4 border-t border-gray-200">
        <Button
          variant="ghost"
          hx-post="/api/v1/onboarding/skip-setup"
          hx-target="#onboarding-content"
          hx-swap="innerHTML"
        >
          Skip for now
        </Button>
        <form
          hx-post="/api/v1/onboarding/complete"
          hx-target="body"
          hx-swap="innerHTML"
        >
          <Button type="submit" variant="primary">
            Complete Setup
          </Button>
        </form>
      </div>
    </div>
  );

  return isFragment ? (
    content
  ) : (
    <OnboardingLayout title="Setup" currentStep={4} assetsBaseUrl={assetsBaseUrl}>
      {content}
    </OnboardingLayout>
  );
};

// Domain Setup Form Component
const DomainSetupForm: FC<{ verified?: boolean }> = ({ verified = false }) => {
  if (verified) {
    return (
      <div class="rounded-lg bg-green-50 p-4 border border-green-200">
        <div class="flex items-start gap-3">
          <svg
            class="h-5 w-5 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fill-rule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clip-rule="evenodd"
            />
          </svg>
          <div>
            <h4 class="text-sm font-medium text-green-900">Domain verified</h4>
            <p class="mt-1 text-sm text-green-700">
              Your domain is ready to send emails
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      hx-post="/api/v1/delivery/domains"
      hx-target="#domain-setup"
      hx-swap="innerHTML"
    >
      <div id="domain-setup" class="space-y-4">
        <Input
          name="domain"
          label="Your domain"
          type="text"
          placeholder="mail.yourdomain.com"
          hint="Use a subdomain like mail.yourdomain.com"
          required
        />

        <Button type="submit" variant="primary" size="sm">
          Add Domain
        </Button>

        {/* DNS Records - shown after domain added */}
        <div class="hidden" id="dns-records">
          <div class="rounded-lg bg-blue-50 p-4 border border-blue-200">
            <h4 class="text-sm font-semibold text-blue-900 mb-3">
              Add these DNS records
            </h4>
            <div class="space-y-3">
              <div class="bg-white rounded p-3 border border-blue-100">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-medium text-gray-700">Type: TXT</span>
                  <button
                    type="button"
                    class="text-xs text-brand-600 hover:text-brand-700"
                    onclick="navigator.clipboard.writeText('v=spf1 include:_spf.mauntic.com ~all')"
                  >
                    Copy
                  </button>
                </div>
                <code class="text-xs text-gray-600 break-all">
                  v=spf1 include:_spf.mauntic.com ~all
                </code>
              </div>
              <div class="bg-white rounded p-3 border border-blue-100">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-medium text-gray-700">Type: CNAME</span>
                  <button
                    type="button"
                    class="text-xs text-brand-600 hover:text-brand-700"
                    onclick="navigator.clipboard.writeText('dkim._domainkey.mauntic.com')"
                  >
                    Copy
                  </button>
                </div>
                <code class="text-xs text-gray-600 break-all">
                  dkim._domainkey.mauntic.com
                </code>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              class="mt-4"
              hx-post="/api/v1/delivery/domains/verify"
              hx-target="#domain-setup"
              hx-swap="innerHTML"
            >
              Verify DNS Records
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};

// Provider Setup Form Component
const ProviderSetupForm: FC = () => {
  return (
    <div class="space-y-4">
      <p class="text-sm text-gray-600">
        Email provider configuration will be set up automatically. You can
        configure custom providers later from settings.
      </p>
      <Button
        variant="primary"
        size="sm"
        hx-post="/api/v1/onboarding/skip-provider"
        hx-target="#onboarding-content"
        hx-swap="innerHTML"
      >
        Continue
      </Button>
    </div>
  );
};

// Contacts Import Form Component
const ContactsImportForm: FC = () => {
  return (
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Import contacts from CSV
        </label>
        <input
          type="file"
          name="file"
          accept=".csv"
          class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
        />
        <p class="mt-2 text-xs text-gray-500">
          CSV should include columns: email, name (optional), and any custom fields
        </p>
      </div>

      <div class="flex gap-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          hx-post="/api/v1/crm/contacts/import"
          hx-encoding="multipart/form-data"
          hx-target="#import-result"
        >
          Upload Contacts
        </Button>
        <Button
          variant="ghost"
          size="sm"
          hx-post="/api/v1/onboarding/skip-contacts"
          hx-target="#onboarding-content"
          hx-swap="innerHTML"
        >
          Skip this step
        </Button>
      </div>

      <div id="import-result"></div>
    </div>
  );
};
