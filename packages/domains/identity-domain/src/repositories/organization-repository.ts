import type { Organization } from '../entities/organization.js';

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  findByUser(userId: string): Promise<Organization[]>;
  save(org: Organization): Promise<void>;
  delete(id: string): Promise<void>;
}
