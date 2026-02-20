import type { ContactId, JourneyId, OrganizationId } from '@mauntic/domain-kernel';
import type { JourneyExecution } from '../entities/journey-execution.js';

export interface ExecutionRepository {
  findById(orgId: OrganizationId, id: string): Promise<JourneyExecution | null>;
  findByJourneyAndContact(
    orgId: OrganizationId,
    journeyId: JourneyId,
    contactId: ContactId,
  ): Promise<JourneyExecution[]>;
  findActiveByJourney(
    orgId: OrganizationId,
    journeyId: JourneyId,
    pagination: { page: number; limit: number },
  ): Promise<{ data: JourneyExecution[]; total: number }>;
  save(execution: JourneyExecution): Promise<void>;
  updateStatus(execution: JourneyExecution): Promise<void>;
}
