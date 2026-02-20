import type { ProviderHealth } from '../entities/provider-health.js';

export interface ProviderHealthRepository {
  findByProvider(
    orgId: string,
    providerId: string,
  ): Promise<ProviderHealth | null>;
  findByOrganization(orgId: string): Promise<ProviderHealth[]>;
  save(health: ProviderHealth): Promise<void>;
}
