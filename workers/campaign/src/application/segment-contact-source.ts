import type { Fetcher } from '@cloudflare/workers-types';
import { createServiceBindingClient } from '@mauntic/worker-clients';

export interface SegmentContact {
  contactId: string;
}

export interface SegmentContactPage {
  contacts: SegmentContact[];
  nextCursor?: string;
  total?: number;
}

export interface SegmentContactSource {
  fetchPage(params: {
    organizationId: string;
    segmentId: string;
    cursor?: string;
    limit: number;
  }): Promise<SegmentContactPage>;
}

type TenantContextLike = {
  organizationId: string;
  userId: string;
  userRole: string;
  plan: string;
};

interface SegmentQueryResponse {
  contacts: Array<{
    id: string;
  }>;
  total: number;
  nextCursor: string | null;
}

/**
 * Placeholder implementation until the CRM worker exposes a public API for segment contacts.
 * Keeps the fan-out pipeline pluggable so we can swap in a real HTTP-backed fetcher later.
 */
export class StubSegmentContactSource implements SegmentContactSource {
  async fetchPage(
    _params: {
      organizationId: string;
      segmentId: string;
      cursor?: string;
      limit: number;
    },
  ): Promise<SegmentContactPage> {
    return { contacts: [] };
  }
}

type DispatchFetcher = Fetcher | undefined;

export class HttpSegmentContactSource implements SegmentContactSource {
  private readonly systemUserId: string;
  private readonly systemUserRole: string;
  private readonly plan: string;

  constructor(
    crmService: Fetcher,
    dispatchService: DispatchFetcher,
    options: {
      systemUserId: string;
      systemUserRole: string;
      plan: string;
    },
  ) {
    this.systemUserId = options.systemUserId;
    this.systemUserRole = options.systemUserRole;
    this.plan = options.plan;
    this.client = createServiceBindingClient(crmService, {
      baseUrl: 'https://crm.internal/',
      defaultHeaders: {
        'Content-Type': 'application/json',
      },
    });
    this.dispatchService = dispatchService;
  }
  private readonly client: ReturnType<typeof createServiceBindingClient>;
  private readonly dispatchService?: DispatchFetcher;

  async fetchPage(params: {
    organizationId: string;
    segmentId: string;
    cursor?: string;
    limit: number;
  }): Promise<SegmentContactPage> {
    const dispatchResult = await this.tryDispatchQuery(params);
    if (dispatchResult) {
      return dispatchResult;
    }

    const response = await this.client.request(
      `/api/v1/crm/segments/${params.segmentId}/query`,
      {
        method: 'POST',
        headers: {
          'X-Tenant-Context': this.buildTenantHeader(params.organizationId),
        },
        body: JSON.stringify({
          cursor: params.cursor,
          limit: params.limit,
        }),
      },
    );
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(
        {
          status: response.status,
          segmentId: params.segmentId,
          organizationId: params.organizationId,
          body: text,
        },
        'Failed to fetch segment contacts from CRM',
      );
      throw new Error('SEGMENT_CONTACT_FETCH_FAILED');
    }

    const payload = (await response.json()) as SegmentQueryResponse;
    return {
      contacts: payload.contacts.map((contact) => ({ contactId: contact.id })),
      nextCursor: payload.nextCursor ?? undefined,
      total: payload.total,
    };
  }

  private buildTenantHeader(organizationId: string): string {
    const context: TenantContextLike = {
      organizationId,
      userId: this.systemUserId,
      userRole: this.systemUserRole,
      plan: this.plan,
    };
    return encodeBase64(JSON.stringify(context));
  }

  private async tryDispatchQuery(params: {
    organizationId: string;
    segmentId: string;
    cursor?: string;
    limit: number;
  }): Promise<SegmentContactPage | null> {
    if (!this.dispatchService) {
      return null;
    }
    try {
      const response = await this.dispatchService.fetch(
        'https://crm.internal/__dispatch/crm/segments/query',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Context': this.buildTenantHeader(params.organizationId),
          },
          body: JSON.stringify({
            organizationId: params.organizationId,
            segmentId: params.segmentId,
            cursor: params.cursor,
            limit: params.limit,
          }),
        },
      );
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.warn(
          {
            status: response.status,
            organizationId: params.organizationId,
            segmentId: params.segmentId,
            body: text,
          },
          'CRM dispatch query failed, falling back to HTTP',
        );
        return null;
      }
      const payload = (await response.json()) as SegmentQueryResponse;
      return {
        contacts: payload.contacts.map((contact) => ({ contactId: contact.id })),
        nextCursor: payload.nextCursor ?? undefined,
        total: payload.total,
      };
    } catch (error) {
      console.warn(
        {
          organizationId: params.organizationId,
          segmentId: params.segmentId,
          error,
        },
        'CRM dispatch query threw error, falling back to HTTP',
      );
      return null;
    }
  }
}

function encodeBase64(value: string): string {
  if (typeof btoa === 'function') {
    return btoa(value);
  }
  return Buffer.from(value, 'utf8').toString('base64');
}
