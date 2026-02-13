import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

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

export class Journey {
  private constructor(private props: JourneyProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    description?: string | null;
    createdBy: string;
  }): Journey {
    if (!input.name || input.name.trim().length === 0) {
      throw new InvariantViolation('Journey name is required');
    }

    return new Journey(
      JourneyPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name.trim(),
        description: input.description ?? null,
        status: 'draft',
        createdBy: input.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: JourneyProps): Journey {
    return new Journey(JourneyPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
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

  update(input: { name?: string; description?: string | null }): void {
    if (input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        throw new InvariantViolation('Journey name cannot be empty');
      }
      this.props.name = input.name.trim();
    }
    if (input.description !== undefined) {
      this.props.description = input.description;
    }
    this.props.updatedAt = new Date();
  }

  /**
   * Publish the journey: transitions from draft to active.
   * Invariant: the journey must have at least one trigger and at least one step
   * to be published. The caller must verify this before calling publish().
   */
  publish(hasTriggers: boolean, hasSteps: boolean): void {
    if (this.props.status !== 'draft') {
      throw new InvariantViolation(
        `Cannot publish journey from status "${this.props.status}"; must be in "draft"`,
      );
    }
    if (!hasTriggers) {
      throw new InvariantViolation('Cannot publish journey without triggers');
    }
    if (!hasSteps) {
      throw new InvariantViolation('Cannot publish journey without steps');
    }
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  pause(): void {
    if (this.props.status !== 'active') {
      throw new InvariantViolation(
        `Cannot pause journey from status "${this.props.status}"; must be "active"`,
      );
    }
    this.props.status = 'paused';
    this.props.updatedAt = new Date();
  }

  resume(): void {
    if (this.props.status !== 'paused') {
      throw new InvariantViolation(
        `Cannot resume journey from status "${this.props.status}"; must be "paused"`,
      );
    }
    this.props.status = 'active';
    this.props.updatedAt = new Date();
  }

  archive(): void {
    if (this.props.status !== 'active' && this.props.status !== 'paused') {
      throw new InvariantViolation(
        `Cannot archive journey from status "${this.props.status}"; must be "active" or "paused"`,
      );
    }
    this.props.status = 'archived';
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<JourneyProps> {
    return Object.freeze({ ...this.props });
  }
}
