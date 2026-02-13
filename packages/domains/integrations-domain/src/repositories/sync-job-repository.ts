import type { SyncJob } from '../entities/sync-job.js';

export interface SyncJobRepository {
  save(syncJob: SyncJob): Promise<void>;
  findById(orgId: string, id: string): Promise<SyncJob | null>;
  findByConnection(
    orgId: string,
    connectionId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: SyncJob[]; total: number }>;
  update(syncJob: SyncJob): Promise<void>;
}
