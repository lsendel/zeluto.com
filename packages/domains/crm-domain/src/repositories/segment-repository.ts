import type {
  ContactId,
  OrganizationId,
  SegmentId,
} from '@mauntic/domain-kernel';
import type { Segment } from '../entities/segment.js';
import type { FilterCriteria } from '../services/segment-filter-engine.js';

export interface SegmentRepository {
  findById(orgId: OrganizationId, id: SegmentId): Promise<Segment | null>;
  findByOrganization(
    orgId: OrganizationId,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Segment[]; total: number }>;
  save(segment: Segment): Promise<void>;
  delete(orgId: OrganizationId, id: SegmentId): Promise<void>;
  addContacts(
    orgId: OrganizationId,
    segmentId: SegmentId,
    contactIds: ContactId[],
  ): Promise<void>;
  removeContacts(
    orgId: OrganizationId,
    segmentId: SegmentId,
    contactIds: ContactId[],
  ): Promise<void>;
  countMatchingContacts(
    orgId: OrganizationId,
    filterCriteria: FilterCriteria,
  ): Promise<number>;
}
