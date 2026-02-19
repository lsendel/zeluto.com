import type { IntentSignal } from '../entities/intent-signal.js';

export interface IntentSignalRepository {
  findById(orgId: string, id: string): Promise<IntentSignal | null>;
  findByContact(orgId: string, contactId: string): Promise<IntentSignal[]>;
  findActiveByContact(orgId: string, contactId: string): Promise<IntentSignal[]>;
  findByType(orgId: string, signalType: string): Promise<IntentSignal[]>;
  save(signal: IntentSignal): Promise<void>;
  deleteExpired(orgId: string): Promise<number>;
}
