import {
  asContactId,
  asOrganizationId,
} from '@mauntic/domain-kernel';
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
      organizationId: asOrganizationId(organizationId),
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
      organizationId: asOrganizationId(tag.organizationId),
      tagId: tag.id,
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
      organizationId: asOrganizationId(input.organizationId),
      tagId: input.tagId,
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
      organizationId: asOrganizationId(input.organizationId),
      contactId: asContactId(input.contactId),
      tagId: input.tagId,
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
      organizationId: asOrganizationId(input.organizationId),
      contactId: asContactId(input.contactId),
      tagId: input.tagId,
    },
    metadata: meta(input.organizationId),
  };
}
