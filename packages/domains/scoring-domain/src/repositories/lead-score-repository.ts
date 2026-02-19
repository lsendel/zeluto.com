import type { LeadScore } from '../entities/lead-score.js';

export interface LeadScoreRepository {
  findByContact(orgId: string, contactId: string): Promise<LeadScore | null>;
  findByOrganization(orgId: string, options?: { minScore?: number; grade?: string; limit?: number; offset?: number }): Promise<LeadScore[]>;
  findLeaderboard(orgId: string, limit: number): Promise<LeadScore[]>;
  save(score: LeadScore): Promise<void>;
  delete(orgId: string, contactId: string): Promise<void>;
}
