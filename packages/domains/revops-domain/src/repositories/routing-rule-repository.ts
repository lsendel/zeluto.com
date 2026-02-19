import type { RoutingRule } from '../entities/routing-rule.js';

export interface RoutingRuleRepository {
  findById(orgId: string, id: string): Promise<RoutingRule | null>;
  findByOrganization(orgId: string): Promise<RoutingRule[]>;
  findEnabled(orgId: string): Promise<RoutingRule[]>;
  save(rule: RoutingRule): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
