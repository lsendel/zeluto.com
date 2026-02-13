import type { Tag } from '../entities/tag.js';

export interface TagRepository {
  findById(orgId: string, id: string): Promise<Tag | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Tag[]; total: number }>;
  save(tag: Tag): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
  tagContact(orgId: string, tagId: string, contactId: string): Promise<void>;
  untagContact(orgId: string, tagId: string, contactId: string): Promise<void>;
  findByContact(orgId: string, contactId: string): Promise<Tag[]>;
}
