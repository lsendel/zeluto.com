import type { DeliveryJob } from '../entities/delivery-job.js';
import type { DeliveryJobStatus } from '../entities/delivery-job.js';

export interface DeliveryJobRepository {
  findById(orgId: string, id: string): Promise<DeliveryJob | null>;
  findByIdempotencyKey(orgId: string, idempotencyKey: string): Promise<DeliveryJob | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: DeliveryJob[]; total: number }>;
  save(job: DeliveryJob): Promise<void>;
  updateStatus(orgId: string, id: string, status: DeliveryJobStatus): Promise<void>;
}
