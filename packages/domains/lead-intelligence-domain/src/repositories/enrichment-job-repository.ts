import type { EnrichmentJob } from '../entities/enrichment-job.js';

export interface EnrichmentJobRepository {
  findById(id: string): Promise<EnrichmentJob | null>;
  findByContact(orgId: string, contactId: string): Promise<EnrichmentJob[]>;
  findPending(orgId: string, limit?: number): Promise<EnrichmentJob[]>;
  save(job: EnrichmentJob): Promise<void>;
}
