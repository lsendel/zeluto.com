import type { EnrichmentProviderAdapter, EnrichmentRequest, EnrichmentAdapterResult } from '@mauntic/lead-intelligence-domain';

export class ClearbitAdapter implements EnrichmentProviderAdapter {
  readonly providerId = 'clearbit';
  readonly supportedFields = ['email', 'firstName', 'lastName', 'company', 'title', 'industry', 'companySize', 'linkedinUrl'] as const;

  constructor(private readonly apiKey: string) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult> {
    const start = Date.now();
    try {
      const response = await fetch(`https://person-stream.clearbit.com/v2/combined/find?email=${encodeURIComponent(request.email ?? '')}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });

      if (!response.ok) {
        return { success: false, fields: [], error: `HTTP ${response.status}`, latencyMs: Date.now() - start, cost: 0 };
      }

      const data = await response.json() as Record<string, unknown>;
      const person = data.person as Record<string, unknown> | undefined;
      const company = data.company as Record<string, unknown> | undefined;

      const fields = [];
      if (person?.email) fields.push({ field: 'email', value: person.email, confidence: 0.95 });
      if ((person as any)?.name?.givenName) fields.push({ field: 'firstName', value: (person as any).name.givenName, confidence: 0.95 });
      if ((person as any)?.name?.familyName) fields.push({ field: 'lastName', value: (person as any).name.familyName, confidence: 0.95 });
      if ((person as any)?.employment?.title) fields.push({ field: 'title', value: (person as any).employment.title, confidence: 0.9 });
      if ((person as any)?.linkedin?.handle) fields.push({ field: 'linkedinUrl', value: `https://linkedin.com/in/${(person as any).linkedin.handle}`, confidence: 0.95 });
      if (company?.name) fields.push({ field: 'company', value: company.name, confidence: 0.95 });
      if ((company as any)?.category?.industry) fields.push({ field: 'industry', value: (company as any).category.industry, confidence: 0.85 });
      if ((company as any)?.metrics?.employees) fields.push({ field: 'companySize', value: (company as any).metrics.employees, confidence: 0.8 });

      return { success: true, fields, latencyMs: Date.now() - start, cost: 0.05 };
    } catch (error) {
      return { success: false, fields: [], error: String(error), latencyMs: Date.now() - start, cost: 0 };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://person-stream.clearbit.com/v2/combined/find?email=test@example.com', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return res.status !== 500;
    } catch {
      return false;
    }
  }
}
