import type { Child, FC } from '@mauntic/ui-kit';

function resolveAssetUrl(
  baseUrl: string | undefined,
  assetPath: string,
): string {
  const normalizedBase = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  const normalizedPath = assetPath.startsWith('/')
    ? assetPath
    : `/${assetPath}`;
  return `${normalizedBase}${normalizedPath}`;
}

export interface OnboardingLayoutProps {
  /** Page title */
  title?: string;
  /** Current step (1-4) */
  currentStep: number;
  /** Page content */
  children: Child;
  /** Additional head content */
  head?: Child;
  /** Base URL for static assets */
  assetsBaseUrl?: string;
}

interface Step {
  number: number;
  name: string;
}

const steps: Step[] = [
  { number: 1, name: 'Account' },
  { number: 2, name: 'Organization' },
  { number: 3, name: 'Plan' },
  { number: 4, name: 'Setup' },
];

export const OnboardingLayout: FC<OnboardingLayoutProps> = ({
  title = 'Getting Started',
  currentStep,
  children,
  head,
  assetsBaseUrl,
}) => {
  const stylesHref = resolveAssetUrl(assetsBaseUrl, '/styles/latest.css');
  return (
    <html lang="en" class="h-full bg-gray-50">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} | Zeluto</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:site_name" content="Zeluto" />
        <meta property="og:title" content={`${title} | Zeluto`} />
        <link rel="stylesheet" href={stylesHref} />
        <script
          src="https://unpkg.com/htmx.org@2.0.4"
          crossorigin="anonymous"
        />
        {head}
      </head>
      <body class="h-full">
        <div class="flex min-h-full flex-col items-center px-4 py-8 sm:px-6 lg:px-8">
          {/* Logo */}
          <div class="mb-8 flex items-center gap-2">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-lg">
              Z
            </div>
            <span class="text-2xl font-bold text-gray-900">Zeluto</span>
          </div>

          {/* Step indicators */}
          <div class="w-full max-w-3xl mb-8">
            <nav aria-label="Progress">
              <ol class="flex items-center justify-center gap-2">
                {steps.map((step, idx) => (
                  <>
                    <li class="flex items-center">
                      <div class="flex flex-col items-center">
                        <div
                          class={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                            step.number < currentStep
                              ? 'border-brand-600 bg-brand-600 text-white'
                              : step.number === currentStep
                                ? 'border-brand-600 bg-white text-brand-600'
                                : 'border-gray-300 bg-white text-gray-400'
                          }`}
                        >
                          {step.number < currentStep ? (
                            <svg
                              class="h-5 w-5"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fill-rule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          ) : (
                            step.number
                          )}
                        </div>
                        <span
                          class={`mt-2 text-xs font-medium ${
                            step.number <= currentStep
                              ? 'text-gray-900'
                              : 'text-gray-500'
                          }`}
                        >
                          {step.name}
                        </span>
                      </div>
                    </li>
                    {idx < steps.length - 1 && (
                      <div
                        class={`h-0.5 w-12 sm:w-20 ${
                          step.number < currentStep
                            ? 'bg-brand-600'
                            : 'bg-gray-300'
                        }`}
                      />
                    )}
                  </>
                ))}
              </ol>
            </nav>
          </div>

          {/* Content */}
          <div id="onboarding-content" class="w-full max-w-2xl">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
};
