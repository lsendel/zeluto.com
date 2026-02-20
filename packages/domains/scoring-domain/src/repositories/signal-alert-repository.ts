import type { SignalAlert } from '../entities/signal-alert.js';

export interface SignalAlertRepository {
  findById(orgId: string, id: string): Promise<SignalAlert | null>;
  findByOrganization(
    orgId: string,
    options?: { status?: string; priority?: string; limit?: number },
  ): Promise<SignalAlert[]>;
  findByContact(orgId: string, contactId: string): Promise<SignalAlert[]>;
  findOverdue(orgId: string): Promise<SignalAlert[]>;
  save(alert: SignalAlert): Promise<void>;
}
