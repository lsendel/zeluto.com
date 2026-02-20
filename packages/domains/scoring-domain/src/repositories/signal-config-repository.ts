import type { OrganizationId } from '@mauntic/domain-kernel';
import type { SignalConfig } from '../entities/signal-config.js';

export interface SignalConfigRepository {
  findBySignalType(
    orgId: OrganizationId,
    signalType: string,
  ): Promise<SignalConfig | null>;
  findByOrganization(orgId: OrganizationId): Promise<SignalConfig[]>;
  findEnabled(orgId: OrganizationId): Promise<SignalConfig[]>;
  save(config: SignalConfig): Promise<void>;
  delete(orgId: OrganizationId, signalType: string): Promise<void>;
}
