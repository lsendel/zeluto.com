import type { ScoreHistory } from '../entities/score-history.js';

export interface ScoreHistoryRepository {
  findByContact(orgId: string, contactId: string, options?: { from?: string; to?: string; limit?: number }): Promise<ScoreHistory[]>;
  save(entry: ScoreHistory): Promise<void>;
  deleteOlderThan(orgId: string, beforeDate: string): Promise<number>;
}
