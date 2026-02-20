import {
  asContactId,
  asOrganizationId,
  asUserId,
} from '@mauntic/domain-kernel';
import type {
  ContactCreatedEvent,
  ContactDeletedEvent,
  ContactImportedEvent,
  ContactMergedEvent,
  ContactUpdatedEvent,
  DomainEventMetadata,
} from '@mauntic/domain-kernel';

// ---------------------------------------------------------------------------
// Metadata helper
// ---------------------------------------------------------------------------

function meta(
  organizationId: string,
  sourceContext = 'crm',
): DomainEventMetadata {
  return {
    id: crypto.randomUUID(),
    version: 1,
    sourceContext,
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
    tenantContext: {
      organizationId: asOrganizationId(organizationId),
    },
  };
}

// ---------------------------------------------------------------------------
// Contact event factories
// ---------------------------------------------------------------------------

export function contactCreated(contact: {
  id: string;
  organizationId: string;
  email?: string | null;
  phone?: string | null;
}): ContactCreatedEvent {
  return {
    type: 'crm.ContactCreated',
    data: {
      organizationId: asOrganizationId(contact.organizationId),
      contactId: asContactId(contact.id),
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
    },
    metadata: meta(contact.organizationId),
  };
}

export function contactUpdated(contact: {
  id: string;
  organizationId: string;
  fields: string[];
}): ContactUpdatedEvent {
  return {
    type: 'crm.ContactUpdated',
    data: {
      organizationId: asOrganizationId(contact.organizationId),
      contactId: asContactId(contact.id),
      fields: contact.fields,
    },
    metadata: meta(contact.organizationId),
  };
}

export function contactDeleted(input: {
  contactId: string;
  organizationId: string;
  deletedBy: string;
}): ContactDeletedEvent {
  return {
    type: 'crm.ContactDeleted',
    data: {
      organizationId: asOrganizationId(input.organizationId),
      contactId: asContactId(input.contactId),
      deletedBy: asUserId(input.deletedBy),
    },
    metadata: meta(input.organizationId),
  };
}

export function contactMerged(input: {
  winnerId: string;
  loserId: string;
  organizationId: string;
  mergedBy: string;
}): ContactMergedEvent {
  return {
    type: 'crm.ContactMerged',
    data: {
      organizationId: asOrganizationId(input.organizationId),
      winnerId: input.winnerId,
      loserId: input.loserId,
      mergedBy: asUserId(input.mergedBy),
    },
    metadata: meta(input.organizationId),
  };
}

export function contactImported(input: {
  organizationId: string;
  importId: string;
  count: number;
  source: string;
}): ContactImportedEvent {
  return {
    type: 'crm.ContactImported',
    data: {
      organizationId: asOrganizationId(input.organizationId),
      importId: input.importId,
      count: input.count,
      source: input.source,
    },
    metadata: meta(input.organizationId),
  };
}
