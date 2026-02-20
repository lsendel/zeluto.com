import type { OrganizationId, UserId } from '../value-objects/branded-id.js';

export interface TenantContext {
  organizationId: OrganizationId;
  userId: UserId;
  userRole: 'owner' | 'admin' | 'member' | 'viewer';
  plan: 'free' | 'starter' | 'pro' | 'enterprise';
}

export type QuotaResource =
  | 'contacts'
  | 'emails_per_month'
  | 'sms_per_month'
  | 'push_per_month'
  | 'journeys'
  | 'team_members'
  | 'custom_domains'
  | 'api_requests_per_day';
