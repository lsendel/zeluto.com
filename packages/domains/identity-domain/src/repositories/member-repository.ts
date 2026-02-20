import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import type { OrganizationMember } from '../entities/organization-member.js';

export interface MemberRepository {
  findById(id: string): Promise<OrganizationMember | null>;
  findByOrganization(
    organizationId: OrganizationId,
  ): Promise<OrganizationMember[]>;
  findByUser(userId: UserId): Promise<OrganizationMember[]>;
  findByOrgAndUser(
    organizationId: OrganizationId,
    userId: UserId,
  ): Promise<OrganizationMember | null>;
  save(member: OrganizationMember): Promise<void>;
  delete(id: string): Promise<void>;
}
