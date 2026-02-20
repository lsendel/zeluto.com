import type { WebhookEndpoint } from '../entities/webhook-endpoint.js';

export interface WebhookEndpointRepository {
  save(endpoint: WebhookEndpoint): Promise<void>;
  findById(orgId: string, id: string): Promise<WebhookEndpoint | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: WebhookEndpoint[]; total: number }>;
  findActiveByEvent(
    orgId: string,
    eventType: string,
  ): Promise<WebhookEndpoint[]>;
  update(endpoint: WebhookEndpoint): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
