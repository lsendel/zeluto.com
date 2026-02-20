import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const SegmentTypeSchema = z.enum(['static', 'dynamic']);

export type SegmentType = z.infer<typeof SegmentTypeSchema>;

export const SegmentPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  type: SegmentTypeSchema,
  filterCriteria: z.unknown().nullable(),
  contactCount: z.number().int().min(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type SegmentProps = z.infer<typeof SegmentPropsSchema>;

export class Segment {
  private constructor(private props: SegmentProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    type: SegmentType;
    description?: string | null;
    filterCriteria?: unknown;
  }): Segment {
    if (!input.name || input.name.trim().length === 0) {
      throw new InvariantViolation('Segment name is required');
    }
    SegmentTypeSchema.parse(input.type);

    return new Segment(
      SegmentPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        filterCriteria: input.filterCriteria ?? null,
        contactCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: SegmentProps): Segment {
    return new Segment(SegmentPropsSchema.parse(props));
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
  get type(): SegmentType {
    return this.props.type;
  }
  get filterCriteria(): unknown {
    return this.props.filterCriteria;
  }
  get contactCount(): number {
    return this.props.contactCount;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  update(input: {
    name?: string;
    description?: string | null;
    filterCriteria?: unknown;
  }): void {
    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        throw new InvariantViolation('Segment name must not be empty');
      }
      this.props.name = input.name;
    }
    if (input.description !== undefined) {
      this.props.description = input.description;
    }
    if (input.filterCriteria !== undefined) {
      this.props.filterCriteria = input.filterCriteria;
    }
    this.props.updatedAt = new Date();
  }

  updateContactCount(count: number): void {
    if (count < 0) {
      throw new InvariantViolation('Contact count cannot be negative');
    }
    this.props.contactCount = count;
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<SegmentProps> {
    return Object.freeze({ ...this.props });
  }
}
