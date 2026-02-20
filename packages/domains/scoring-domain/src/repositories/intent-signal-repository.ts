import type { OrganizationId, ContactId, IntentSignalId } from '@mauntic/domain-kernel';
import type { IntentSignal } from '../entities/intent-signal.js';

export interface IntentSignalRepository {
  findById(orgId: OrganizationId, id: IntentSignalId): Promise<IntentSignal | null>;
  findByContact(orgId: OrganizationId, contactId: ContactId): Promise<IntentSignal[]>;
  findActiveByContact(
    orgId: OrganizationId,
    contactId: ContactId,
  ): Promise<IntentSignal[]>;
  findByType(orgId: OrganizationId, signalType: string): Promise<IntentSignal[]>;
  save(signal: IntentSignal): Promise<void>;
  deleteExpired(orgId: OrganizationId): Promise<number>;
}
