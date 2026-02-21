import type { FC } from 'hono/jsx';

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  joinedAt: Date | string;
}

export interface MemberListProps {
  members: MemberRow[];
  total: number;
  orgId: string;
}

const roleColors: Record<string, { bg: string; text: string }> = {
  owner: { bg: 'bg-purple-100', text: 'text-purple-700' },
  admin: { bg: 'bg-blue-100', text: 'text-blue-700' },
  member: { bg: 'bg-gray-100', text: 'text-gray-700' },
  viewer: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const MemberListView: FC<MemberListProps> = ({
  members,
  total,
  orgId,
}) => {
  return (
    <div id="settings-members">
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
              class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              General
            </a>
            <a
              href="/app/settings/members"
              hx-get="/app/settings/members"
              hx-target="#app-content"
              hx-push-url="true"
              class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
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

      {/* Member count + invite link */}
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-gray-500">{total} members</p>
        <a
          href="/app/settings/invites"
          hx-get="/app/settings/invites"
          hx-target="#app-content"
          hx-push-url="true"
          class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
        >
          + Invite Member
        </a>
      </div>

      {/* Members table */}
      <div class="overflow-hidden rounded-lg border border-gray-200">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Member
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Role
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Joined
                </th>
                <th
                  scope="col"
                  class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              {members.length === 0 ? (
                <tr>
                  <td
                    colspan={4}
                    class="px-6 py-12 text-center text-sm text-gray-500"
                  >
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((m) => {
                  const colors = roleColors[m.role] ?? {
                    bg: 'bg-gray-100',
                    text: 'text-gray-700',
                  };
                  const initials = m.name
                    ? m.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)
                    : m.email[0].toUpperCase();

                  return (
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                          <div class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                            {initials}
                          </div>
                          <div>
                            <p class="text-sm font-medium text-gray-900">
                              {m.name || '(no name)'}
                            </p>
                            <p class="text-xs text-gray-500">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                        >
                          {m.role}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(m.joinedAt)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {m.role !== 'owner' && (
                          <button
                            hx-delete={`/api/v1/identity/organizations/${orgId}/members/${m.userId}`}
                            hx-confirm={`Remove ${m.name || m.email} from this organization?`}
                            hx-target="#app-content"
                            class="text-sm text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
