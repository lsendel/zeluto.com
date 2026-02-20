import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const PointEventTypeSchema = z.enum([
  'email.opened',
  'email.clicked',
  'form.submitted',
  'page.visited',
  'contact.tagged',
  'custom',
]);
export type PointEventType = z.infer<typeof PointEventTypeSchema>;

export const PointRulePropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  eventType: PointEventTypeSchema,
  points: z.number().int(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PointRuleProps = z.infer<typeof PointRulePropsSchema>;

export class PointRule {
  private constructor(private props: PointRuleProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    eventType: PointEventType;
    points: number;
    description?: string | null;
  }): PointRule {
    if (input.points === 0) {
      throw new InvariantViolation('Points value cannot be zero');
    }

    return new PointRule(
      PointRulePropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        eventType: input.eventType,
        points: input.points,
        description: input.description ?? null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: PointRuleProps): PointRule {
    return new PointRule(PointRulePropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get eventType(): PointEventType {
    return this.props.eventType;
  }
  get points(): number {
    return this.props.points;
  }
  get description(): string | null {
    return this.props.description;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  update(input: { points?: number; description?: string | null }): void {
    if (input.points !== undefined) {
      if (input.points === 0) {
        throw new InvariantViolation('Points value cannot be zero');
      }
      this.props.points = input.points;
    }
    if (input.description !== undefined) {
      this.props.description = input.description;
    }
    this.props.updatedAt = new Date();
  }

  activate(): void {
    this.props.isActive = true;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<PointRuleProps> {
    return Object.freeze({ ...this.props });
  }
}
