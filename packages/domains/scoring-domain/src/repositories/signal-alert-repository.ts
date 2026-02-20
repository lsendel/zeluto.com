import type { OrganizationId, ContactId, SignalAlertId } from '@mauntic/domain-kernel';
import type { SignalAlert } from '../entities/signal-alert.js';

export interface SignalAlertRepository {
  findById(orgId: OrganizationId, id: SignalAlertId): Promise<SignalAlert | null>;
  findByOrganization(
    orgId: OrganizationId,
    options?: { status?: string; priority?: string; limit?: number },
  ): Promise<SignalAlert[]>;
  findByContact(orgId: OrganizationId, contactId: ContactId): Promise<SignalAlert[]>;
  findOverdue(orgId: OrganizationId): Promise<SignalAlert[]>;
  save(alert: SignalAlert): Promise<void>;
}
