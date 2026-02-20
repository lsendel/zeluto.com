import {
  AggregateRoot,
  type OrganizationId,
  Result,
} from '@mauntic/domain-kernel';
import { z } from 'zod';

export const JourneyStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'archived',
]);

export type JourneyStatus = z.infer<typeof JourneyStatusSchema>;

export const JourneyPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: JourneyStatusSchema,
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type JourneyProps = z.infer<typeof JourneyPropsSchema>;

export class Journey extends AggregateRoot<JourneyProps> {
  private constructor(props: JourneyProps) {
    super(props.id, props);
  }

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    description?: string | null;
    createdBy: string;
  }): Result<Journey> {
    if (!input.name || input.name.trim().length === 0) {
      return Result.fail('Journey name is required');
    }

    const id = crypto.randomUUID();
    const props = JourneyPropsSchema.parse({
      id,
      organizationId: input.organizationId,
      name: input.name.trim(),
      description: input.description ?? null,
      status: 'draft',
      createdBy: input.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const journey = new Journey(props);
    return Result.ok(journey);
  }

  static reconstitute(props: JourneyProps): Result<Journey> {
    return Result.ok(new Journey(JourneyPropsSchema.parse(props)));
  }

  // ---- Accessors ----

  get journeyId(): string {
    return this.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string | null {
    return this.props.description;
  }
  get status(): JourneyStatus {
    return this.props.status;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  update(input: { name?: string; description?: string | null }): Result<void> {
    if (input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        return Result.fail('Journey name cannot be empty');
      }
      this.props.name = input.name.trim();
    }
    if (input.description !== undefined) {
      this.props.description = input.description;
    }
    this.props.updatedAt = new Date();
    return Result.ok();
  }

  /**
   * Publish the journey: transitions from draft to active.
   * Invariant: the journey must have at least one trigger and at least one step
   * to be published. The caller must verify this before calling publish().
   */
  publish(hasTriggers: boolean, hasSteps: boolean): Result<void> {
    if (this.props.status !== 'draft') {
      return Result.fail(
        `Cannot publish journey from status "${this.props.status}"; must be in "draft"`,
      );
    }
    if (!hasTriggers) {
      return Result.fail('Cannot publish journey without triggers');
    }
    if (!hasSteps) {
      return Result.fail('Cannot publish journey without steps');
    }
    this.props.status = 'active';
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      type: 'journey.JourneyPublished',
      data: {
        organizationId: this.props.organizationId,
        journeyId: this.id,
        versionId: 'latest', // TODO: Pass version info if needed
        publishedAt: this.props.updatedAt.toISOString(),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: this.id,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
    return Result.ok();
  }

  pause(): Result<void> {
    if (this.props.status !== 'active') {
      return Result.fail(
        `Cannot pause journey from status "${this.props.status}"; must be "active"`,
      );
    }
    this.props.status = 'paused';
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      type: 'journey.JourneyPaused',
      data: {
        organizationId: this.props.organizationId,
        journeyId: this.id,
        pausedAt: this.props.updatedAt.toISOString(),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: this.id,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
    return Result.ok();
  }

  resume(): Result<void> {
    if (this.props.status !== 'paused') {
      return Result.fail(
        `Cannot resume journey from status "${this.props.status}"; must be "paused"`,
      );
    }
    this.props.status = 'active';
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      type: 'journey.JourneyResumed',
      data: {
        organizationId: this.props.organizationId,
        journeyId: this.id,
        resumedAt: this.props.updatedAt.toISOString(),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: this.id,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
    return Result.ok();
  }

  archive(): Result<void> {
    if (this.props.status !== 'active' && this.props.status !== 'paused') {
      return Result.fail(
        `Cannot archive journey from status "${this.props.status}"; must be "active" or "paused"`,
      );
    }
    this.props.status = 'archived';
    this.props.updatedAt = new Date();

    this.addDomainEvent({
      type: 'journey.JourneyArchived',
      data: {
        organizationId: this.props.organizationId,
        journeyId: this.id,
        archivedAt: this.props.updatedAt.toISOString(),
      },
      metadata: {
        id: crypto.randomUUID(),
        version: 1,
        sourceContext: 'journey',
        timestamp: new Date().toISOString(),
        correlationId: this.id,
        tenantContext: {
          organizationId: this.props.organizationId as OrganizationId,
        },
      },
    });
    return Result.ok();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<JourneyProps> {
    return Object.freeze({ ...this.props });
  }
}
