import type { EnrichmentProviderAdapter, EnrichmentRequest, EnrichmentAdapterResult } from '@mauntic/lead-intelligence-domain';

export class ZoomInfoAdapter implements EnrichmentProviderAdapter {
  readonly providerId = 'zoominfo';
  readonly supportedFields = ['phone', 'company', 'title', 'industry', 'companySize'] as const;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.zoominfo.com',
  ) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/enrich/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          emailAddress: request.email,
          firstName: request.firstName,
          lastName: request.lastName,
          companyName: request.company,
        }),
      });

      if (!response.ok) {
        return { success: false, fields: [], error: `HTTP ${response.status}`, latencyMs: Date.now() - start, cost: 0 };
      }

      const data = await response.json() as { data?: Array<Record<string, unknown>> };
      const contact = data.data?.[0];
      if (!contact) {
        return { success: false, fields: [], error: 'No match', latencyMs: Date.now() - start, cost: 0.05 };
      }

      const fields = [];
      if (contact.phone) fields.push({ field: 'phone', value: contact.phone, confidence: 0.85 });
      if (contact.company?.name) fields.push({ field: 'company', value: (contact.company as any).name, confidence: 0.9 });
      if (contact.jobTitle) fields.push({ field: 'title', value: contact.jobTitle, confidence: 0.85 });
      if (contact.company?.industry) fields.push({ field: 'industry', value: (contact.company as any).industry, confidence: 0.8 });
      if (contact.company?.employeeCount) fields.push({ field: 'companySize', value: (contact.company as any).employeeCount, confidence: 0.85 });

      return { success: true, fields, latencyMs: Date.now() - start, cost: 0.10 };
    } catch (error) {
      return { success: false, fields: [], error: String(error), latencyMs: Date.now() - start, cost: 0 };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
