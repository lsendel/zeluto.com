import type { JourneyId, OrganizationId } from '@mauntic/domain-kernel';
import { Result } from '@mauntic/domain-kernel';
import {
  Journey,
  type JourneyRepository,
  type JourneyStatus,
  type JourneyTriggerRepository,
  JourneyVersion,
  type JourneyVersionRepository,
} from '@mauntic/journey-domain';

export class JourneyService {
  constructor(
    private readonly journeyRepo: JourneyRepository,
    private readonly versionRepo: JourneyVersionRepository,
    private readonly triggerRepo: JourneyTriggerRepository,
  ) {}

  async list(
    orgId: OrganizationId,
    pagination: {
      page: number;
      limit: number;
      search?: string;
      status?: JourneyStatus;
    },
  ): Promise<{ data: Journey[]; total: number }> {
    return this.journeyRepo.findByOrganization(orgId, pagination);
  }

  async getById(orgId: OrganizationId, id: JourneyId): Promise<Journey | null> {
    return this.journeyRepo.findById(orgId, id);
  }

  async create(input: {
    organizationId: string;
    name: string;
    description?: string | null;
    createdBy: string;
  }): Promise<Result<Journey>> {
    const result = Journey.create(input);
    if (result.isFailure) return result;

    await this.journeyRepo.save(result.getValue());
    return result;
  }

  async update(
    orgId: OrganizationId,
    id: JourneyId,
    input: { name?: string; description?: string | null },
  ): Promise<Result<Journey>> {
    const journey = await this.journeyRepo.findById(orgId, id);
    if (!journey) return Result.fail('Journey not found');

    const updateResult = journey.update(input);
    if (updateResult.isFailure) return Result.fail(updateResult.getError());

    await this.journeyRepo.save(journey);
    return Result.ok(journey);
  }

  async publish(
    orgId: OrganizationId,
    id: JourneyId,
    definition: Record<string, unknown>,
  ): Promise<Result<{ journey: Journey; version: JourneyVersion }>> {
    const journey = await this.journeyRepo.findById(orgId, id);
    if (!journey) return Result.fail('Journey not found');

    const triggers = await this.triggerRepo.findByJourney(orgId, id);
    const hasTriggers = triggers.length > 0;
    const hasSteps =
      Array.isArray((definition as any).steps) &&
      (definition as any).steps.length > 0;

    const publishResult = journey.publish(hasTriggers, hasSteps);
    if (publishResult.isFailure) return Result.fail(publishResult.getError());

    const nextVersionNum = await this.versionRepo.getNextVersionNumber(
      orgId,
      id,
    );
    const versionResult = JourneyVersion.create({
      journeyId: id,
      organizationId: orgId,
      versionNumber: nextVersionNum,
      definition,
    });
    if (versionResult.isFailure)
      return Result.fail(versionResult.getError() as string);

    const version = versionResult.getValue();
    await Promise.all([
      this.journeyRepo.save(journey),
      this.versionRepo.save(version),
    ]);

    return Result.ok({ journey, version });
  }

  async pause(orgId: OrganizationId, id: JourneyId): Promise<Result<Journey>> {
    const journey = await this.journeyRepo.findById(orgId, id);
    if (!journey) return Result.fail('Journey not found');

    const pauseResult = journey.pause();
    if (pauseResult.isFailure) return Result.fail(pauseResult.getError());

    await this.journeyRepo.save(journey);
    return Result.ok(journey);
  }

  async resume(orgId: OrganizationId, id: JourneyId): Promise<Result<Journey>> {
    const journey = await this.journeyRepo.findById(orgId, id);
    if (!journey) return Result.fail('Journey not found');

    const resumeResult = journey.resume();
    if (resumeResult.isFailure) return Result.fail(resumeResult.getError());

    await this.journeyRepo.save(journey);
    return Result.ok(journey);
  }

  async remove(orgId: OrganizationId, id: JourneyId): Promise<Result<void>> {
    const journey = await this.journeyRepo.findById(orgId, id);
    if (!journey) return Result.fail('Journey not found');

    await this.journeyRepo.delete(orgId, id);
    return Result.ok();
  }
}
