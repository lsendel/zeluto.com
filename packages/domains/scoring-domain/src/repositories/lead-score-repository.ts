import type { OrganizationId, ContactId } from '@mauntic/domain-kernel';
import type { LeadScore } from '../entities/lead-score.js';

export interface LeadScoreRepository {
  findByContact(orgId: OrganizationId, contactId: ContactId): Promise<LeadScore | null>;
  findByOrganization(
    orgId: OrganizationId,
    options?: {
      minScore?: number;
      grade?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<LeadScore[]>;
  findLeaderboard(orgId: OrganizationId, limit: number): Promise<LeadScore[]>;
  save(score: LeadScore): Promise<void>;
  delete(orgId: OrganizationId, contactId: ContactId): Promise<void>;
}
