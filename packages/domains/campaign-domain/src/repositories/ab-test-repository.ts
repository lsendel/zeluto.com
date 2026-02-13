import type { AbTest } from '../entities/ab-test.js';

export interface AbTestRepository {
  findById(orgId: string, id: string): Promise<AbTest | null>;
  findByCampaign(orgId: string, campaignId: string): Promise<AbTest[]>;
  save(abTest: AbTest): Promise<void>;
}
