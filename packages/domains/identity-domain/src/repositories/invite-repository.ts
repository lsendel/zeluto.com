import type { OrganizationId } from '@mauntic/domain-kernel';
import type { OrganizationInvite } from '../entities/organization-invite.js';

export interface InviteRepository {
  findById(id: string): Promise<OrganizationInvite | null>;
  findByToken(token: string): Promise<OrganizationInvite | null>;
  findByOrganization(organizationId: OrganizationId): Promise<OrganizationInvite[]>;
  findPendingByEmail(email: string): Promise<OrganizationInvite[]>;
  save(invite: OrganizationInvite): Promise<void>;
  delete(id: string): Promise<void>;
}
