import type { Journey } from '../entities/journey.js';

export interface JourneyRepository {
  findById(orgId: string, id: string): Promise<Journey | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Journey[]; total: number }>;
  save(journey: Journey): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
