import type { JourneyVersion } from '../entities/journey-version.js';

export interface JourneyVersionRepository {
  findById(orgId: string, id: string): Promise<JourneyVersion | null>;
  findLatestByJourney(
    orgId: string,
    journeyId: string,
  ): Promise<JourneyVersion | null>;
  findByJourney(orgId: string, journeyId: string): Promise<JourneyVersion[]>;
  save(version: JourneyVersion): Promise<void>;
}
