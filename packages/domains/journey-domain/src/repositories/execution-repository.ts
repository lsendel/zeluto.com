import type { JourneyExecution } from '../entities/journey-execution.js';

export interface ExecutionRepository {
  findById(orgId: string, id: string): Promise<JourneyExecution | null>;
  findByJourneyAndContact(
    orgId: string,
    journeyId: string,
    contactId: string,
  ): Promise<JourneyExecution[]>;
  findActiveByJourney(
    orgId: string,
    journeyId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: JourneyExecution[]; total: number }>;
  save(execution: JourneyExecution): Promise<void>;
  updateStatus(execution: JourneyExecution): Promise<void>;
}
