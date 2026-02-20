import type { SignalConfig } from '../entities/signal-config.js';

export interface SignalConfigRepository {
  findBySignalType(
    orgId: string,
    signalType: string,
  ): Promise<SignalConfig | null>;
  findByOrganization(orgId: string): Promise<SignalConfig[]>;
  findEnabled(orgId: string): Promise<SignalConfig[]>;
  save(config: SignalConfig): Promise<void>;
  delete(orgId: string, signalType: string): Promise<void>;
}
