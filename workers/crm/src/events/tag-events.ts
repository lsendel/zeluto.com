import type {
  ContactTaggedEvent,
  ContactUntaggedEvent,
  DomainEventMetadata,
  TagCreatedEvent,
  TagDeletedEvent,
} from '@mauntic/domain-kernel';

function meta(organizationId: string): DomainEventMetadata {
  return {
    id: crypto.randomUUID(),
    version: 1,
    sourceContext: 'crm',
    timestamp: new Date().toISOString(),
    correlationId: crypto.randomUUID(),
    tenantContext: {
      organizationId: organizationId as unknown as number,
    },
  };
}

export function tagCreated(tag: {
  id: string;
  organizationId: string;
  name: string;
}): TagCreatedEvent {
  return {
    type: 'crm.TagCreated',
    data: {
      organizationId: tag.organizationId as unknown as number,
      tagId: tag.id as unknown as number,
      name: tag.name,
    },
    metadata: meta(tag.organizationId),
  };
}

export function tagDeleted(input: {
  tagId: string;
  organizationId: string;
}): TagDeletedEvent {
  return {
    type: 'crm.TagDeleted',
    data: {
      organizationId: input.organizationId as unknown as number,
      tagId: input.tagId as unknown as number,
    },
    metadata: meta(input.organizationId),
  };
}

export function contactTagged(input: {
  contactId: string;
  tagId: string;
  organizationId: string;
}): ContactTaggedEvent {
  return {
    type: 'crm.ContactTagged',
    data: {
      organizationId: input.organizationId as unknown as number,
      contactId: input.contactId as unknown as number,
      tagId: input.tagId as unknown as number,
    },
    metadata: meta(input.organizationId),
  };
}

export function contactUntagged(input: {
  contactId: string;
  tagId: string;
  organizationId: string;
}): ContactUntaggedEvent {
  return {
    type: 'crm.ContactUntagged',
    data: {
      organizationId: input.organizationId as unknown as number,
      contactId: input.contactId as unknown as number,
      tagId: input.tagId as unknown as number,
    },
    metadata: meta(input.organizationId),
  };
}
