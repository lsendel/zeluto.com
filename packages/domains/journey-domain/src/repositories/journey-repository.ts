import type { JourneyId, OrganizationId } from '@mauntic/domain-kernel';
import type { Journey, JourneyStatus } from '../entities/journey.js';

export interface JourneyRepository {
  findById(orgId: OrganizationId, id: JourneyId): Promise<Journey | null>;
  findByOrganization(
    orgId: OrganizationId,
    pagination: {
      page: number;
      limit: number;
      search?: string;
      status?: JourneyStatus;
    },
  ): Promise<{ data: Journey[]; total: number }>;
  save(journey: Journey): Promise<void>;
  delete(orgId: OrganizationId, id: JourneyId): Promise<void>;
}
