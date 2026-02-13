import type { AnalyticsEvent } from '../entities/analytics-event.js';

export interface AnalyticsEventQuery {
  eventType?: string;
  entityType?: string;
  entityId?: string;
  contactId?: string;
  startDate?: Date;
  endDate?: Date;
  page: number;
  limit: number;
}

export interface AnalyticsEventRepository {
  save(event: AnalyticsEvent): Promise<void>;
  saveMany(events: AnalyticsEvent[]): Promise<void>;
  findById(orgId: string, id: string): Promise<AnalyticsEvent | null>;
  findByOrganization(
    orgId: string,
    query: AnalyticsEventQuery,
  ): Promise<{ data: AnalyticsEvent[]; total: number }>;
  findByContact(
    orgId: string,
    contactId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: AnalyticsEvent[]; total: number }>;
  countByType(
    orgId: string,
    eventType: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number>;
  delete(orgId: string, id: string): Promise<void>;
}
