import type { OrganizationId, ContactId } from '@mauntic/domain-kernel';
import type { ScoreHistory } from '../entities/score-history.js';

export interface ScoreHistoryRepository {
  findByContact(
    orgId: OrganizationId,
    contactId: ContactId,
    options?: { from?: string; to?: string; limit?: number },
  ): Promise<ScoreHistory[]>;
  save(entry: ScoreHistory): Promise<void>;
  deleteOlderThan(orgId: OrganizationId, beforeDate: string): Promise<number>;
}
