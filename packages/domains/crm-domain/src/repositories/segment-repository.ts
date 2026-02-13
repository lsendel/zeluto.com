import type { Segment } from '../entities/segment.js';

export interface SegmentRepository {
  findById(orgId: string, id: string): Promise<Segment | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Segment[]; total: number }>;
  save(segment: Segment): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
  addContacts(orgId: string, segmentId: string, contactIds: string[]): Promise<void>;
  removeContacts(orgId: string, segmentId: string, contactIds: string[]): Promise<void>;
}
