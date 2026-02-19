import type { EnrichmentProviderAdapter, EnrichmentRequest, EnrichmentAdapterResult } from '@mauntic/lead-intelligence-domain';

export class LushaAdapter implements EnrichmentProviderAdapter {
  readonly providerId = 'lusha';
  readonly supportedFields = ['phone', 'email', 'company'] as const;

  constructor(private readonly apiKey: string) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult> {
    const start = Date.now();
    try {
      const params: Record<string, string> = {};
      if (request.firstName) params.firstName = request.firstName;
      if (request.lastName) params.lastName = request.lastName;
      if (request.company) params.company = request.company;

      const query = new URLSearchParams(params).toString();
      const response = await fetch(`https://api.lusha.com/person?${query}`, {
        headers: { 'api_key': this.apiKey },
      });

      if (!response.ok) {
        return { success: false, fields: [], error: `HTTP ${response.status}`, latencyMs: Date.now() - start, cost: 0 };
      }

      const data = await response.json() as Record<string, unknown>;

      const fields = [];
      const phoneNumbers = data.phoneNumbers as Array<{ number: string; type: string }> | undefined;
      if (phoneNumbers?.[0]) {
        const directDial = phoneNumbers.find(p => p.type === 'direct') ?? phoneNumbers[0];
        fields.push({ field: 'phone', value: directDial.number, confidence: 0.9 });
      }
      const emailAddresses = data.emailAddresses as Array<{ email: string; type: string }> | undefined;
      if (emailAddresses?.[0]) fields.push({ field: 'email', value: emailAddresses[0].email, confidence: 0.85 });
      if (data.company) fields.push({ field: 'company', value: (data.company as any).name ?? data.company, confidence: 0.85 });

      return { success: true, fields, latencyMs: Date.now() - start, cost: 0.08 };
    } catch (error) {
      return { success: false, fields: [], error: String(error), latencyMs: Date.now() - start, cost: 0 };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://api.lusha.com/health', {
        headers: { 'api_key': this.apiKey },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
