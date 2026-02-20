import type {
  DomainEventMetadata,
  SegmentCreatedEvent,
  SegmentRebuiltEvent,
  SegmentUpdatedEvent,
} from '@mauntic/domain-kernel';
import {
  asOrganizationId,
  asSegmentId,
  asUserId,
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

export function segmentCreated(segment: {
  id: string;
  organizationId: string;
  name: string;
  createdBy: string;
}): SegmentCreatedEvent {
  return {
    type: 'crm.SegmentCreated',
    data: {
      organizationId: asOrganizationId(segment.organizationId),
      segmentId: asSegmentId(segment.id),
      name: segment.name,
      createdBy: asUserId(segment.createdBy),
    },
    metadata: meta(segment.organizationId),
  };
}

export function segmentUpdated(segment: {
  id: string;
  organizationId: string;
  fields: string[];
}): SegmentUpdatedEvent {
  return {
    type: 'crm.SegmentUpdated',
    data: {
      organizationId: asOrganizationId(segment.organizationId),
      segmentId: asSegmentId(segment.id),
      fields: segment.fields,
    },
    metadata: meta(segment.organizationId),
  };
}

export function segmentRebuilt(input: {
  segmentId: string;
  organizationId: string;
  contactCount: number;
  previousCount: number;
}): SegmentRebuiltEvent {
  return {
    type: 'crm.SegmentRebuilt',
    data: {
      organizationId: asOrganizationId(input.organizationId),
      segmentId: asSegmentId(input.segmentId),
      contactCount: input.contactCount,
      previousCount: input.previousCount,
    },
    metadata: meta(input.organizationId),
  };
}
