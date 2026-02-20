import type {
  JourneyId,
  JourneyVersionId,
  OrganizationId,
} from '@mauntic/domain-kernel';
import type { JourneyVersion } from '../entities/journey-version.js';

export interface JourneyVersionRepository {
  findById(
    orgId: OrganizationId,
    id: JourneyVersionId,
  ): Promise<JourneyVersion | null>;
  findLatestByJourney(
    orgId: OrganizationId,
    journeyId: JourneyId,
  ): Promise<JourneyVersion | null>;
  findByJourney(
    orgId: OrganizationId,
    journeyId: JourneyId,
  ): Promise<JourneyVersion[]>;
  save(version: JourneyVersion): Promise<void>;
}
