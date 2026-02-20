import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const TagPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  color: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type TagProps = z.infer<typeof TagPropsSchema>;

export class Tag {
  private constructor(private props: TagProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    color?: string | null;
  }): Tag {
    if (!input.name || input.name.trim().length === 0) {
      throw new InvariantViolation('Tag name is required');
    }

    return new Tag(
      TagPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        color: input.color ?? null,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: TagProps): Tag {
    return new Tag(TagPropsSchema.parse(props));
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
  get color(): string | null {
    return this.props.color;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<TagProps> {
    return Object.freeze({ ...this.props });
  }
}
