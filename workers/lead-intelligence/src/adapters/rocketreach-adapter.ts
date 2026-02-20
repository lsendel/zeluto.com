import type {
  EnrichmentAdapterResult,
  EnrichmentProviderAdapter,
  EnrichmentRequest,
} from '@mauntic/lead-intelligence-domain';

export class RocketReachAdapter implements EnrichmentProviderAdapter {
  readonly providerId = 'rocketreach';
  readonly supportedFields = [
    'email',
    'phone',
    'linkedinUrl',
    'title',
    'company',
  ] as const;

  constructor(private readonly apiKey: string) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult> {
    const start = Date.now();
    try {
      const params: Record<string, string> = {};
      if (request.email) params.email = request.email;
      if (request.firstName) params.first_name = request.firstName;
      if (request.lastName) params.last_name = request.lastName;
      if (request.company) params.current_employer = request.company;
      if (request.linkedinUrl) params.linkedin_url = request.linkedinUrl;

      const response = await fetch(
        'https://api.rocketreach.co/api/v2/person/lookup',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': this.apiKey,
          },
          body: JSON.stringify(params),
        },
      );

      if (!response.ok) {
        return {
          success: false,
          fields: [],
          error: `HTTP ${response.status}`,
          latencyMs: Date.now() - start,
          cost: 0,
        };
      }

      const data = (await response.json()) as Record<string, unknown>;

      const fields = [];
      const emails = data.emails as string[] | undefined;
      if (emails?.[0])
        fields.push({ field: 'email', value: emails[0], confidence: 0.85 });
      const phones = data.phones as Array<{ number: string }> | undefined;
      if (phones?.[0])
        fields.push({
          field: 'phone',
          value: phones[0].number,
          confidence: 0.8,
        });
      if (data.linkedin_url)
        fields.push({
          field: 'linkedinUrl',
          value: data.linkedin_url,
          confidence: 0.95,
        });
      if (data.current_title)
        fields.push({
          field: 'title',
          value: data.current_title,
          confidence: 0.85,
        });
      if (data.current_employer)
        fields.push({
          field: 'company',
          value: data.current_employer,
          confidence: 0.85,
        });

      return {
        success: true,
        fields,
        latencyMs: Date.now() - start,
        cost: 0.04,
      };
    } catch (error) {
      return {
        success: false,
        fields: [],
        error: String(error),
        latencyMs: Date.now() - start,
        cost: 0,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch('https://api.rocketreach.co/api/v2/account', {
        headers: { 'Api-Key': this.apiKey },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
