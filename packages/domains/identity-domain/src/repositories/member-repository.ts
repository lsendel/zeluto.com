import type { OrganizationMember } from '../entities/organization-member.js';

export interface MemberRepository {
  findById(id: string): Promise<OrganizationMember | null>;
  findByOrganization(organizationId: string): Promise<OrganizationMember[]>;
  findByUser(userId: string): Promise<OrganizationMember[]>;
  findByOrgAndUser(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMember | null>;
  save(member: OrganizationMember): Promise<void>;
  delete(id: string): Promise<void>;
}
