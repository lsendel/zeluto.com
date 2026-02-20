import type { Channel } from '../entities/delivery-job.js';
import type { ProviderConfig } from '../entities/provider-config.js';

export interface ProviderConfigRepository {
  findById(orgId: string, id: string): Promise<ProviderConfig | null>;
  findActiveByOrgAndChannel(
    orgId: string,
    channel: Channel,
  ): Promise<ProviderConfig[]>;
  findByOrganization(orgId: string): Promise<ProviderConfig[]>;
  save(config: ProviderConfig): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
