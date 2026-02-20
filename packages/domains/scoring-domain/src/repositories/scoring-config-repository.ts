import type { OrganizationId, ScoringConfigId } from '@mauntic/domain-kernel';

export interface ScoringConfigEntry {
  id: ScoringConfigId;
  organizationId: OrganizationId;
  category: string;
  factor: string;
  weight: number;
  enabled: boolean;
}

export interface ScoringConfigRepository {
  findByOrganization(orgId: OrganizationId): Promise<ScoringConfigEntry[]>;
  findByCategory(
    orgId: OrganizationId,
    category: string,
  ): Promise<ScoringConfigEntry[]>;
  save(config: ScoringConfigEntry): Promise<void>;
  saveBatch(configs: ScoringConfigEntry[]): Promise<void>;
  delete(orgId: OrganizationId, id: ScoringConfigId): Promise<void>;
}
