import type { EnrichmentProvider } from '../entities/enrichment-provider.js';

export interface EnrichmentProviderRepository {
  findById(orgId: string, id: string): Promise<EnrichmentProvider | null>;
  findByOrganization(orgId: string): Promise<EnrichmentProvider[]>;
  findByField(orgId: string, fieldName: string): Promise<EnrichmentProvider[]>;
  save(provider: EnrichmentProvider): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
