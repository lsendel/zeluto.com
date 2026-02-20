import type { JourneyId, OrganizationId } from '@mauntic/domain-kernel';
import type { JourneyTrigger } from '../entities/journey-trigger.js';

export interface JourneyTriggerRepository {
  findByJourney(orgId: OrganizationId, journeyId: JourneyId): Promise<JourneyTrigger[]>;
  findByEventType(orgId: OrganizationId, eventType: string): Promise<JourneyTrigger[]>;
  save(trigger: JourneyTrigger): Promise<void>;
  delete(orgId: OrganizationId, id: string): Promise<void>;
}
