import type {
  EnrichmentAdapterResult,
  EnrichmentProviderAdapter,
  EnrichmentRequest,
} from '@mauntic/lead-intelligence-domain';

export class ApolloAdapter implements EnrichmentProviderAdapter {
  readonly providerId = 'apollo';
  readonly supportedFields = [
    'email',
    'firstName',
    'lastName',
    'phone',
    'title',
    'company',
    'linkedinUrl',
  ] as const;

  constructor(private readonly apiKey: string) {}

  async enrich(request: EnrichmentRequest): Promise<EnrichmentAdapterResult> {
    const start = Date.now();
    try {
      const response = await fetch(
        'https://api.apollo.io/api/v1/people/match',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Api-Key': this.apiKey,
          },
          body: JSON.stringify({
            email: request.email,
            first_name: request.firstName,
            last_name: request.lastName,
            organization_name: request.company,
            linkedin_url: request.linkedinUrl,
          }),
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

      const data = (await response.json()) as {
        person?: Record<string, unknown>;
      };
      const person = data.person;
      if (!person) {
        return {
          success: false,
          fields: [],
          error: 'No match found',
          latencyMs: Date.now() - start,
          cost: 0.01,
        };
      }

      const fields = [];
      if (person.email)
        fields.push({ field: 'email', value: person.email, confidence: 0.9 });
      if (person.first_name)
        fields.push({
          field: 'firstName',
          value: person.first_name,
          confidence: 0.9,
        });
      if (person.last_name)
        fields.push({
          field: 'lastName',
          value: person.last_name,
          confidence: 0.9,
        });
      if (person.phone_number)
        fields.push({
          field: 'phone',
          value: person.phone_number,
          confidence: 0.8,
        });
      if (person.title)
        fields.push({ field: 'title', value: person.title, confidence: 0.85 });
      if (person.organization_name)
        fields.push({
          field: 'company',
          value: person.organization_name,
          confidence: 0.9,
        });
      if (person.linkedin_url)
        fields.push({
          field: 'linkedinUrl',
          value: person.linkedin_url,
          confidence: 0.95,
        });

      return {
        success: true,
        fields,
        latencyMs: Date.now() - start,
        cost: 0.03,
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
      const res = await fetch('https://api.apollo.io/api/v1/auth/health', {
        headers: { 'X-Api-Key': this.apiKey },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
