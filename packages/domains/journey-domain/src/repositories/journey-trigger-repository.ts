import type { JourneyTrigger } from '../entities/journey-trigger.js';

export interface JourneyTriggerRepository {
  findByJourney(orgId: string, journeyId: string): Promise<JourneyTrigger[]>;
  findByEventType(orgId: string, eventType: string): Promise<JourneyTrigger[]>;
  save(trigger: JourneyTrigger): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
