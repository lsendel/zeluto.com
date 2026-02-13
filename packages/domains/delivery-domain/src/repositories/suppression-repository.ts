import type { SuppressionEntry } from '../entities/suppression-entry.js';

export interface SuppressionRepository {
  findById(orgId: string, id: string): Promise<SuppressionEntry | null>;
  isBlocked(orgId: string, email: string): Promise<boolean>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: SuppressionEntry[]; total: number }>;
  save(entry: SuppressionEntry): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
