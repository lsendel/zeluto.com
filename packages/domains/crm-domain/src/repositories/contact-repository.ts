import type {
  ContactId,
  OrganizationId,
  SegmentId,
} from '@mauntic/domain-kernel';
import type { Contact } from '../entities/contact.js';

export interface ContactRepository {
  findById(orgId: OrganizationId, id: ContactId): Promise<Contact | null>;
  findByEmail(orgId: OrganizationId, email: string): Promise<Contact | null>;
  findByOrganization(
    orgId: OrganizationId,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Contact[]; total: number }>;
  findBySegment(
    orgId: OrganizationId,
    segmentId: SegmentId,
    pagination: { offset: number; limit: number },
  ): Promise<{ data: Contact[]; total: number; nextOffset: number | null }>;
  save(contact: Contact): Promise<void>;
  saveMany(contacts: Contact[]): Promise<void>;
  delete(orgId: OrganizationId, id: ContactId): Promise<void>;
  countByOrganization(orgId: OrganizationId): Promise<number>;
}
