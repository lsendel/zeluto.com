import type {
  JourneyId,
  JourneyVersionId,
  OrganizationId,
} from '@mauntic/domain-kernel';
import { Result } from '@mauntic/domain-kernel';
import { JourneyVersion } from '../entities/journey-version.js';
import type { JourneyVersionRepository } from '../repositories/journey-version-repository.js';

export interface JourneyDefinition {
  steps: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
    positionX: number;
    positionY: number;
  }>;
  connections: Array<{
    fromStepId: string;
    toStepId: string;
    label?: string;
  }>;
  triggers: Array<{
    id: string;
    type: string;
    config: Record<string, unknown>;
  }>;
}

/**
 * Creates immutable JourneyVersions with incrementing version numbers.
 *
 * In-flight executions remain pinned to their version.
 * New executions use the latest published version.
 */
export class VersioningService {
  constructor(private readonly versionRepo: JourneyVersionRepository) {}

  /**
   * Create a new immutable version from the current journey definition.
   * The version number is incremented from the latest existing version.
   */
  async createVersion(
    journeyId: JourneyId,
    organizationId: OrganizationId,
    definition: JourneyDefinition,
  ): Promise<Result<JourneyVersion>> {
    const latest = await this.versionRepo.findLatestByJourney(
      organizationId,
      journeyId,
    );
    const nextVersionNumber = latest ? latest.versionNumber + 1 : 1;

    const versionResult = JourneyVersion.create({
      journeyId,
      organizationId,
      versionNumber: nextVersionNumber,
      definition: definition as unknown as Record<string, unknown>,
    });

    if (versionResult.isFailure) {
      return Result.fail(versionResult.getError());
    }

    const version = versionResult.getValue();
    await this.versionRepo.save(version);
    return Result.ok(version);
  }

  /**
   * Get the latest published version for new executions.
   */
  async getLatestVersion(
    organizationId: OrganizationId,
    journeyId: JourneyId,
  ): Promise<JourneyVersion | null> {
    return this.versionRepo.findLatestByJourney(organizationId, journeyId);
  }

  /**
   * Get a specific version for an in-flight execution.
   */
  async getVersionById(
    organizationId: OrganizationId,
    versionId: JourneyVersionId,
  ): Promise<JourneyVersion | null> {
    return this.versionRepo.findById(organizationId, versionId);
  }
}
