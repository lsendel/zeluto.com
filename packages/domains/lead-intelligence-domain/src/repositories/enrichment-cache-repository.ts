export interface EnrichmentCacheEntry {
  contactId: string;
  fieldName: string;
  providerId: string;
  value: unknown;
  confidence: number;
  expiresAt: Date;
}

export interface EnrichmentCacheRepository {
  get(
    orgId: string,
    contactId: string,
    fieldName: string,
  ): Promise<EnrichmentCacheEntry | null>;
  set(orgId: string, entry: EnrichmentCacheEntry): Promise<void>;
  invalidate(
    orgId: string,
    contactId: string,
    fieldName?: string,
  ): Promise<void>;
  deleteExpired(): Promise<number>;
}
