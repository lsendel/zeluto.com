import type { WaterfallConfig } from '../entities/waterfall-config.js';

export interface WaterfallConfigRepository {
  findByField(orgId: string, fieldName: string): Promise<WaterfallConfig | null>;
  findByOrganization(orgId: string): Promise<WaterfallConfig[]>;
  save(config: WaterfallConfig): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
