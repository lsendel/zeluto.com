import type { Campaign } from '../entities/campaign.js';

export interface CampaignRepository {
  findById(orgId: string, id: string): Promise<Campaign | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Campaign[]; total: number }>;
  save(campaign: Campaign): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
