import { Modal } from '@mauntic/ui-kit';
import type { FC } from 'hono/jsx';

export interface OrgSwitcherModalProps {
  currentOrgId?: string;
  organizations: Array<{
    id: string;
    name: string;
    slug?: string | null;
    plan?: string | null;
    role?: string | null;
  }>;
}

export const OrgSwitcherModal: FC<OrgSwitcherModalProps> = ({
  currentOrgId,
  organizations,
}) => {
  const hasMultiple = organizations.length > 1;
  return (
    <Modal id="org-switcher-modal" title="Switch Organization" size="md">
      <div class="space-y-4">
        <p class="text-sm text-gray-600">
          Pick an organization to change your workspace context. Switching
          reloads the dashboard with the selected org&apos;s data.
        </p>

        {organizations.length === 0 ? (
          <div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            You only belong to one organization right now. Invite your team or
            create another workspace to enable switching.
          </div>
        ) : (
          <ul class="space-y-3">
            {organizations.map((org) => {
              const isCurrent = org.id === currentOrgId;
              return (
                <li key={org.id}>
                  <button
                    type="button"
                    class={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                      isCurrent
                        ? 'border-brand-200 bg-brand-50 text-brand-900'
                        : 'border-gray-200 bg-white text-gray-900 hover:border-brand-200 hover:bg-brand-50'
                    }`}
                    aria-current={isCurrent ? 'true' : undefined}
                    disabled={isCurrent}
                    hx-post={`/api/v1/identity/organizations/${org.id}/switch`}
                    hx-swap="none"
                    hx-on--after-request="window.location.href='/app/dashboard'"
                  >
                    <div>
                      <p class="text-sm font-semibold">{org.name}</p>
                      <div class="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                        {org.slug && <span>slug: {org.slug}</span>}
                        {org.plan && (
                          <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">
                            {org.plan}
                          </span>
                        )}
                        {org.role && (
                          <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-600">
                            {org.role}
                          </span>
                        )}
                        {isCurrent && (
                          <span class="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                    {!isCurrent && (
                      <svg
                        class="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {hasMultiple && (
          <p class="text-xs text-gray-500">
            Tip: Switching organizations will refresh your browser to ensure
            tenant data stays in sync across every worker.
          </p>
        )}
      </div>
    </Modal>
  );
};
