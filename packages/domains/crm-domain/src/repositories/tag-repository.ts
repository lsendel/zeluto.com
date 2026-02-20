import type { ContactId, OrganizationId } from '@mauntic/domain-kernel';
import type { Tag } from '../entities/tag.js';

export interface TagRepository {
  findById(orgId: OrganizationId, id: string): Promise<Tag | null>;
  findByName(orgId: OrganizationId, name: string): Promise<Tag | null>;
  findByOrganization(
    orgId: OrganizationId,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Tag[]; total: number }>;
  save(tag: Tag): Promise<void>;
  delete(orgId: OrganizationId, id: string): Promise<void>;
  tagContact(
    orgId: OrganizationId,
    tagId: string,
    contactId: ContactId,
  ): Promise<void>;
  untagContact(
    orgId: OrganizationId,
    tagId: string,
    contactId: ContactId,
  ): Promise<void>;
  findByContact(orgId: OrganizationId, contactId: ContactId): Promise<Tag[]>;
}
