import { z } from 'zod';
import { Entity, Result } from '@mauntic/domain-kernel';

export const JourneyVersionPropsSchema = z.object({
  id: z.string().uuid(),
  journeyId: z.string().uuid(),
  organizationId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  definition: z.record(z.string(), z.unknown()),
  publishedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type JourneyVersionProps = z.infer<typeof JourneyVersionPropsSchema>;

/**
 * Immutable snapshot of a journey definition at publish time.
 * In-flight executions remain pinned to their version.
 */
export class JourneyVersion extends Entity<JourneyVersionProps> {
  private constructor(props: JourneyVersionProps) {
    super(props.id, props);
  }

  // ---- Factory methods ----

  static create(input: {
    journeyId: string;
    organizationId: string;
    versionNumber: number;
    definition: Record<string, unknown>;
  }): Result<JourneyVersion> {
    const id = crypto.randomUUID();
    const props = JourneyVersionPropsSchema.parse({
      id,
      journeyId: input.journeyId,
      organizationId: input.organizationId,
      versionNumber: input.versionNumber,
      definition: input.definition,
      publishedAt: new Date(),
      createdAt: new Date(),
    });
    return Result.ok(new JourneyVersion(props));
  }

  static reconstitute(props: JourneyVersionProps): Result<JourneyVersion> {
    return Result.ok(new JourneyVersion(JourneyVersionPropsSchema.parse(props)));
  }

  // ---- Accessors ----

  get versionId(): string {
    return this.id;
  }
  get journeyId(): string {
    return this.props.journeyId;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get versionNumber(): number {
    return this.props.versionNumber;
  }
  get definition(): Record<string, unknown> {
    return this.props.definition;
  }
  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<JourneyVersionProps> {
    return Object.freeze({ ...this.props });
  }
}
