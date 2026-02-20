export interface ScoringConfigEntry {
  id: string;
  organizationId: string;
  category: string;
  factor: string;
  weight: number;
  enabled: boolean;
}

export interface ScoringConfigRepository {
  findByOrganization(orgId: string): Promise<ScoringConfigEntry[]>;
  findByCategory(
    orgId: string,
    category: string,
  ): Promise<ScoringConfigEntry[]>;
  save(config: ScoringConfigEntry): Promise<void>;
  saveBatch(configs: ScoringConfigEntry[]): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
