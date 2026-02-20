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
      // DomainEventMetadata currently declares organizationId as number.
      // We pass the UUID and cast to satisfy the legacy type until the
      // kernel type is updated to string.
      organizationId: organizationId as unknown as number,
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
      organizationId: contact.organizationId as unknown as number,
      contactId: contact.id as unknown as number,
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
      organizationId: contact.organizationId as unknown as number,
      contactId: contact.id as unknown as number,
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
      organizationId: input.organizationId as unknown as number,
      contactId: input.contactId as unknown as number,
      deletedBy: input.deletedBy as unknown as number,
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
      organizationId: input.organizationId as unknown as number,
      winnerId: input.winnerId as unknown as number,
      loserId: input.loserId as unknown as number,
      mergedBy: input.mergedBy as unknown as number,
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
      organizationId: input.organizationId as unknown as number,
      importId: input.importId,
      count: input.count,
      source: input.source,
    },
    metadata: meta(input.organizationId),
  };
}
