import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import type { Organization } from '../entities/organization.js';

export interface OrganizationRepository {
  findById(id: OrganizationId): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findByUser(userId: UserId): Promise<Organization[]>;
  save(org: Organization): Promise<void>;
  delete(id: OrganizationId): Promise<void>;
}
