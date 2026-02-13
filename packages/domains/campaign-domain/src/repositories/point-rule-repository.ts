import type { PointRule } from '../entities/point-rule.js';
import type { PointEventType } from '../entities/point-rule.js';

export interface PointRuleRepository {
  findById(orgId: string, id: string): Promise<PointRule | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: PointRule[]; total: number }>;
  findByEventType(orgId: string, eventType: PointEventType): Promise<PointRule[]>;
  save(rule: PointRule): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
