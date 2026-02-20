export interface EnrichmentRequest {
  contactId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  domain?: string;
  linkedinUrl?: string;
}

export interface EnrichmentFieldResult {
  field: string;
  value: unknown;
  confidence: number;
}

export interface EnrichmentAdapterResult {
  success: boolean;
  fields: EnrichmentFieldResult[];
  error?: string;
  latencyMs: number;
  cost: number;
}

export interface EnrichmentProviderAdapter {
  readonly providerId: string;
  readonly supportedFields: readonly string[];
  enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult>;
  enrichBatch?(
    requests: EnrichmentRequest[],
  ): Promise<EnrichmentAdapterResult[]>;
  healthCheck(): Promise<boolean>;
}
