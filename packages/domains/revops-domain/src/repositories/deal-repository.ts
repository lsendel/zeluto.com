import type { Deal } from '../entities/deal.js';

export interface DealRepository {
  findById(orgId: string, id: string): Promise<Deal | null>;
  findByOrganization(orgId: string, options?: { stage?: string; assignedRep?: string; limit?: number; offset?: number }): Promise<Deal[]>;
  findByContact(orgId: string, contactId: string): Promise<Deal[]>;
  save(deal: Deal): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
  countByStage(orgId: string): Promise<Record<string, number>>;
}
