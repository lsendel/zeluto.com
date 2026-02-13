import type {
  SegmentCreatedEvent,
  SegmentUpdatedEvent,
  SegmentRebuiltEvent,
  DomainEventMetadata,
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

export function segmentCreated(segment: {
  id: string;
  organizationId: string;
  name: string;
  createdBy: string;
}): SegmentCreatedEvent {
  return {
    type: 'crm.SegmentCreated',
    data: {
      organizationId: segment.organizationId as unknown as number,
      segmentId: segment.id as unknown as number,
      name: segment.name,
      createdBy: segment.createdBy as unknown as number,
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
      organizationId: segment.organizationId as unknown as number,
      segmentId: segment.id as unknown as number,
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
      organizationId: input.organizationId as unknown as number,
      segmentId: input.segmentId as unknown as number,
      contactCount: input.contactCount,
      previousCount: input.previousCount,
    },
    metadata: meta(input.organizationId),
  };
}
