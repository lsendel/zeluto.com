import type { FC } from 'hono/jsx';

export interface InviteRow {
  id: string;
  email: string;
  role: string;
  status: string | null;
  expiresAt: Date | string;
  createdAt: Date | string;
}

export interface InviteListProps {
  invites: InviteRow[];
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

function isExpired(d: Date | string): boolean {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date < new Date();
}

export const InviteListView: FC<InviteListProps> = ({ invites, orgId }) => {
  const pendingInvites = invites.filter(
    (i) => i.status !== 'accepted' && !isExpired(i.expiresAt),
  );
  const expiredInvites = invites.filter(
    (i) => i.status !== 'accepted' && isExpired(i.expiresAt),
  );

  return (
    <div id="settings-invites">
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
              class="whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700"
            >
              Members
            </a>
            <a
              href="/app/settings/invites"
              hx-get="/app/settings/invites"
              hx-target="#app-content"
              hx-push-url="true"
              class="whitespace-nowrap border-b-2 border-brand-500 py-3 text-sm font-medium text-brand-600"
            >
              Invites
            </a>
          </nav>
        </div>
      </div>

      {/* Invite form */}
      <div class="mb-6 max-w-xl">
        <form
          hx-post={`/api/v1/identity/organizations/${orgId}/invites`}
          hx-target="#app-content"
          hx-swap="innerHTML"
          hx-ext="json-enc"
          class="rounded-lg border border-gray-200 bg-white p-4"
        >
          <h3 class="text-sm font-semibold text-gray-900 mb-3">
            Send Invitation
          </h3>
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <label
                for="email"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="user@example.com"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div class="w-32">
              <label
                for="role"
                class="mb-1 block text-sm font-medium text-gray-700"
              >
                Role
              </label>
              <select
                id="role"
                name="role"
                class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button
              type="submit"
              class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div class="mb-6">
          <h3 class="text-sm font-semibold text-gray-900 mb-3">
            Pending Invitations ({pendingInvites.length})
          </h3>
          <div class="overflow-hidden rounded-lg border border-gray-200">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    class="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500"
                  >
                    Email
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
                    Expires
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
                {pendingInvites.map((invite) => {
                  const colors = roleColors[invite.role] ?? {
                    bg: 'bg-gray-100',
                    text: 'text-gray-700',
                  };
                  return (
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 text-sm text-gray-900">
                        {invite.email}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span
                          class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                        >
                          {invite.role}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(invite.expiresAt)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex gap-3">
                          <button
                            hx-post={`/api/v1/identity/organizations/${orgId}/invites/${invite.id}/resend`}
                            hx-target="#app-content"
                            class="text-sm text-brand-600 hover:text-brand-800"
                          >
                            Resend
                          </button>
                          <button
                            hx-delete={`/api/v1/identity/organizations/${orgId}/invites/${invite.id}`}
                            hx-confirm="Cancel this invitation?"
                            hx-target="#app-content"
                            class="text-sm text-red-600 hover:text-red-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expired invites */}
      {expiredInvites.length > 0 && (
        <div>
          <h3 class="text-sm font-semibold text-gray-500 mb-3">
            Expired ({expiredInvites.length})
          </h3>
          <div class="overflow-hidden rounded-lg border border-gray-200 opacity-60">
            <table class="min-w-full divide-y divide-gray-200">
              <tbody class="divide-y divide-gray-200 bg-white">
                {expiredInvites.map((invite) => (
                  <tr>
                    <td class="px-6 py-3 text-sm text-gray-500">
                      {invite.email}
                    </td>
                    <td class="px-6 py-3 text-sm text-gray-400">
                      {invite.role}
                    </td>
                    <td class="px-6 py-3 text-sm text-red-400">
                      Expired {formatDate(invite.expiresAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {invites.length === 0 && (
        <div class="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p class="text-sm text-gray-500">
            No invitations yet. Use the form above to invite team members.
          </p>
        </div>
      )}
    </div>
  );
};
