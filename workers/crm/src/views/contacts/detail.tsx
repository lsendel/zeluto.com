import type { FC } from 'hono/jsx';
import type { ContactRow } from '../../infrastructure/repositories/contact-repository.js';

export interface ContactDetailProps {
  contact: ContactRow;
  activeTab?: 'overview' | 'activity' | 'tags';
}

function formatDate(d: Date | string | null): string {
  if (!d) return '-';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function contactName(contact: ContactRow): string {
  const parts = [contact.first_name, contact.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '(no name)';
}

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  unsubscribed: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  bounced: { bg: 'bg-red-100', text: 'text-red-700' },
  do_not_contact: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

const OverviewTab: FC<{ contact: ContactRow }> = ({ contact }) => {
  const fields = contact.custom_fields as Record<string, unknown> | null;

  return (
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Basic info */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Contact Information</h3>
        <dl class="space-y-3">
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Email</dt>
            <dd class="text-sm text-gray-900">{contact.email || '-'}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Phone</dt>
            <dd class="text-sm text-gray-900">{contact.phone || '-'}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Status</dt>
            <dd>
              <span
                class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  statusColors[contact.status]?.bg ?? 'bg-gray-100'
                } ${statusColors[contact.status]?.text ?? 'text-gray-700'}`}
              >
                {contact.status.replace(/_/g, ' ')}
              </span>
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Stage</dt>
            <dd class="text-sm text-gray-900 capitalize">{contact.stage || '-'}</dd>
          </div>
        </dl>
      </div>

      {/* Dates */}
      <div class="rounded-lg border border-gray-200 bg-white p-6">
        <h3 class="text-sm font-semibold text-gray-900 mb-4">Dates</h3>
        <dl class="space-y-3">
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Created</dt>
            <dd class="text-sm text-gray-900">{formatDate(contact.created_at)}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Updated</dt>
            <dd class="text-sm text-gray-900">{formatDate(contact.updated_at)}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-sm text-gray-500">Last Activity</dt>
            <dd class="text-sm text-gray-900">{formatDate(contact.last_activity_at)}</dd>
          </div>
        </dl>
      </div>

      {/* Custom fields */}
      {fields && Object.keys(fields).length > 0 && (
        <div class="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
          <h3 class="text-sm font-semibold text-gray-900 mb-4">Custom Fields</h3>
          <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(fields).map(([key, value]) => (
              <div key={key} class="flex justify-between">
                <dt class="text-sm text-gray-500">{key}</dt>
                <dd class="text-sm text-gray-900">{String(value ?? '-')}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
};

const ActivityTab: FC<{ contact: ContactRow }> = ({ contact }) => {
  return (
    <div
      id="activity-feed"
      hx-get={`/api/v1/crm/contacts/${contact.id}/activity`}
      hx-trigger="load"
      hx-swap="innerHTML"
    >
      <div class="flex items-center justify-center py-12">
        <div class="text-sm text-gray-500">Loading activity...</div>
      </div>
    </div>
  );
};

const TagsTab: FC<{ contact: ContactRow }> = ({ contact }) => {
  return (
    <div class="rounded-lg border border-gray-200 bg-white p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-gray-900">Tags</h3>
        <button
          class="text-sm font-medium text-brand-600 hover:text-brand-800"
          hx-get={`/api/v1/crm/contacts/${contact.id}/tags`}
          hx-target="#tags-list"
        >
          + Add Tag
        </button>
      </div>
      <div
        id="tags-list"
        hx-get={`/api/v1/crm/contacts/${contact.id}/tags`}
        hx-trigger="load"
        hx-swap="innerHTML"
      >
        <p class="text-sm text-gray-500">Loading tags...</p>
      </div>
    </div>
  );
};

export const ContactDetailView: FC<ContactDetailProps> = ({
  contact,
  activeTab = 'overview',
}) => {
  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'activity' as const, label: 'Activity' },
    { id: 'tags' as const, label: 'Tags' },
  ];

  return (
    <div id="contact-detail">
      {/* Header */}
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-4">
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
          <span class="text-sm text-gray-900">{contactName(contact)}</span>
        </div>

        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-lg font-medium">
              {(contact.first_name?.[0] ?? contact.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-900">{contactName(contact)}</h1>
              <p class="text-sm text-gray-500">{contact.email || 'No email'}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              hx-get={`/app/crm/contacts/${contact.id}/edit`}
              hx-target="#app-content"
              hx-push-url="true"
              class="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              hx-delete={`/api/v1/crm/contacts/${contact.id}`}
              hx-confirm="Are you sure you want to delete this contact? This action cannot be undone."
              hx-target="#app-content"
              hx-swap="innerHTML"
              class="inline-flex items-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div class="border-b border-gray-200 mb-6">
        <nav class="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              hx-get={`/app/crm/contacts/${contact.id}?tab=${tab.id}`}
              hx-target="#app-content"
              hx-push-url="true"
              class={`whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors ${
                tab.id === activeTab
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div id="tab-content">
        {activeTab === 'overview' && <OverviewTab contact={contact} />}
        {activeTab === 'activity' && <ActivityTab contact={contact} />}
        {activeTab === 'tags' && <TagsTab contact={contact} />}
      </div>
    </div>
  );
};
