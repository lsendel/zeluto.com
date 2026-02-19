import type { EnrichmentProviderAdapter, EnrichmentRequest, EnrichmentAdapterResult } from '@mauntic/lead-intelligence-domain';

export class HunterAdapter implements EnrichmentProviderAdapter {
  readonly providerId = 'hunter';
  readonly supportedFields = ['email', 'firstName', 'lastName', 'company'] as const;

  constructor(private readonly apiKey: string) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult> {
    const start = Date.now();
    try {
      const params = new URLSearchParams({ api_key: this.apiKey });
      if (request.email) params.set('email', request.email);
      else if (request.domain && request.firstName && request.lastName) {
        params.set('domain', request.domain);
        params.set('first_name', request.firstName);
        params.set('last_name', request.lastName);
      }

      const response = await fetch(`https://api.hunter.io/v2/email-finder?${params}`);

      if (!response.ok) {
        return { success: false, fields: [], error: `HTTP ${response.status}`, latencyMs: Date.now() - start, cost: 0 };
      }

      const data = await response.json() as { data?: Record<string, unknown> };
      const result = data.data;
      if (!result) {
        return { success: false, fields: [], error: 'No result', latencyMs: Date.now() - start, cost: 0.01 };
      }

      const fields = [];
      if (result.email) fields.push({ field: 'email', value: result.email, confidence: (result.score as number ?? 80) / 100 });
      if (result.first_name) fields.push({ field: 'firstName', value: result.first_name, confidence: 0.85 });
      if (result.last_name) fields.push({ field: 'lastName', value: result.last_name, confidence: 0.85 });
      if (result.company) fields.push({ field: 'company', value: result.company, confidence: 0.8 });

      return { success: true, fields, latencyMs: Date.now() - start, cost: 0.02 };
    } catch (error) {
      return { success: false, fields: [], error: String(error), latencyMs: Date.now() - start, cost: 0 };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`https://api.hunter.io/v2/account?api_key=${this.apiKey}`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
