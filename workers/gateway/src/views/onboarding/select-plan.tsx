import type { FC } from '@mauntic/ui-kit';
import { Badge, Button } from '@mauntic/ui-kit';
import { OnboardingLayout } from './layout';

interface Plan {
  name: string;
  displayName: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  features: string[];
  popular?: boolean;
}

const plans: Plan[] = [
  {
    name: 'free',
    displayName: 'Free',
    description: 'Perfect for trying out Zeluto',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Up to 1,000 contacts',
      '5,000 emails/month',
      'Basic templates',
      'Email support',
    ],
  },
  {
    name: 'starter',
    displayName: 'Starter',
    description: 'Great for small teams getting started',
    priceMonthly: 29,
    priceYearly: 290,
    popular: true,
    features: [
      'Up to 10,000 contacts',
      '50,000 emails/month',
      'Advanced templates',
      'A/B testing',
      'Priority email support',
      'Custom domains',
    ],
  },
  {
    name: 'pro',
    displayName: 'Pro',
    description: 'For growing businesses with advanced needs',
    priceMonthly: 99,
    priceYearly: 990,
    features: [
      'Up to 100,000 contacts',
      '500,000 emails/month',
      'All templates',
      'Advanced analytics',
      'API access',
      'Phone support',
      'Custom integrations',
    ],
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Custom solutions for large organizations',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'Unlimited contacts',
      'Unlimited emails',
      'Dedicated account manager',
      'Custom SLA',
      'SSO & SAML',
      'Advanced security',
      'Custom contracts',
    ],
  },
];

type SelectPlanViewProps = {
  assetsBaseUrl?: string;
};

export const SelectPlanView: FC<SelectPlanViewProps> = ({ assetsBaseUrl }) => {
  return (
    <OnboardingLayout
      title="Select Plan"
      currentStep={3}
      assetsBaseUrl={assetsBaseUrl}
    >
      <div>
        {/* Heading */}
        <div class="mb-8 text-center">
          <h1 class="text-2xl font-bold tracking-tight text-gray-900">
            Choose your plan
          </h1>
          <p class="mt-2 text-sm text-gray-600">
            Start with a free plan or upgrade for more features
          </p>
        </div>

        {/* Plan Cards */}
        <div class="grid gap-6 lg:grid-cols-2">
          {plans.map((plan) => (
            <div
              class={`relative rounded-xl border bg-white p-6 shadow-sm ${
                plan.popular
                  ? 'border-brand-500 ring-2 ring-brand-500'
                  : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div class="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge variant="primary" size="sm">
                    Most Popular
                  </Badge>
                </div>
              )}

              {/* Plan header */}
              <div class="mb-4">
                <h3 class="text-lg font-semibold text-gray-900">
                  {plan.displayName}
                </h3>
                <p class="mt-1 text-sm text-gray-600">{plan.description}</p>
              </div>

              {/* Pricing */}
              <div class="mb-6">
                {plan.name === 'enterprise' ? (
                  <div class="text-3xl font-bold text-gray-900">
                    Custom pricing
                  </div>
                ) : (
                  <>
                    <div class="flex items-baseline gap-1">
                      <span class="text-3xl font-bold text-gray-900">
                        ${plan.priceMonthly}
                      </span>
                      <span class="text-sm text-gray-600">/month</span>
                    </div>
                    {plan.priceYearly > 0 && (
                      <p class="mt-1 text-sm text-gray-600">
                        or ${plan.priceYearly}/year (save{' '}
                        {Math.round(
                          ((plan.priceMonthly * 12 - plan.priceYearly) /
                            (plan.priceMonthly * 12)) *
                            100,
                        )}
                        %)
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* Features */}
              <ul class="mb-6 space-y-3">
                {plan.features.map((feature) => (
                  <li class="flex items-start gap-3">
                    <svg
                      class="h-5 w-5 flex-shrink-0 text-brand-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fill-rule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clip-rule="evenodd"
                      />
                    </svg>
                    <span class="text-sm text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {plan.name === 'free' ? (
                <form
                  hx-post="/api/v1/onboarding/select-plan"
                  hx-vals={`{"plan": "${plan.name}"}`}
                  hx-target="#onboarding-content"
                  hx-swap="innerHTML"
                >
                  <Button
                    type="submit"
                    variant={plan.popular ? 'primary' : 'secondary'}
                    class="w-full justify-center"
                  >
                    Start Free
                  </Button>
                </form>
              ) : plan.name === 'enterprise' ? (
                <a href="mailto:sales@mauntic.com">
                  <Button variant="secondary" class="w-full justify-center">
                    Contact Sales
                  </Button>
                </a>
              ) : (
                <form
                  hx-post="/api/v1/billing/subscription/checkout"
                  hx-vals={`{"planName": "${plan.name}", "billingPeriod": "monthly"}`}
                  hx-target="#onboarding-content"
                  hx-swap="innerHTML"
                >
                  <Button
                    type="submit"
                    variant={plan.popular ? 'primary' : 'secondary'}
                    class="w-full justify-center"
                  >
                    Select {plan.displayName}
                  </Button>
                </form>
              )}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p class="mt-8 text-center text-sm text-gray-600">
          You can change or cancel your plan anytime from the billing settings
        </p>
      </div>
    </OnboardingLayout>
  );
};
