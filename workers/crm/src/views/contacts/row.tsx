import type { FC } from 'hono/jsx';
import type { ContactRow } from '../../infrastructure/repositories/contact-repository.js';

export interface ContactRowProps {
  contact: ContactRow;
}

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    unsubscribed: 'bg-yellow-100 text-yellow-800',
    bounced: 'bg-red-100 text-red-700',
    do_not_contact: 'bg-gray-100 text-gray-700',
  };
  const cls = colors[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span
      class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
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

function contactName(contact: ContactRow): string {
  const parts = [contact.first_name, contact.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '(no name)';
}

export const ContactRowView: FC<ContactRowProps> = ({ contact }) => {
  return (
    <tr
      id={`contact-row-${contact.id}`}
      class="hover:bg-gray-50 transition-colors cursor-pointer"
      hx-get={`/app/crm/contacts/${contact.id}`}
      hx-target="#app-content"
      hx-push-url="true"
    >
      <td class="whitespace-nowrap px-6 py-4">
        <div class="flex items-center">
          <div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-medium">
            {(
              contact.first_name?.[0] ??
              contact.email?.[0] ??
              '?'
            ).toUpperCase()}
          </div>
          <div class="ml-3">
            <div class="text-sm font-medium text-gray-900">
              {contactName(contact)}
            </div>
          </div>
        </div>
      </td>
      <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
        {contact.email || '-'}
      </td>
      <td class="whitespace-nowrap px-6 py-4">{statusBadge(contact.status)}</td>
      <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
        {formatDate(contact.last_activity_at)}
      </td>
      <td class="whitespace-nowrap px-6 py-4 text-sm">
        <div class="flex items-center gap-2">
          <button
            class="text-brand-600 hover:text-brand-800 text-sm font-medium"
            hx-get={`/app/crm/contacts/${contact.id}/edit`}
            hx-target="#app-content"
            hx-push-url="true"
            onclick="event.stopPropagation()"
          >
            Edit
          </button>
          <button
            class="text-red-600 hover:text-red-800 text-sm font-medium"
            hx-delete={`/api/v1/crm/contacts/${contact.id}`}
            hx-confirm="Are you sure you want to delete this contact?"
            hx-target={`#contact-row-${contact.id}`}
            hx-swap="outerHTML"
            onclick="event.stopPropagation()"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
};
