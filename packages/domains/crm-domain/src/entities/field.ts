import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const FieldEntityTypeSchema = z.enum(['contact', 'company']);

export type FieldEntityType = z.infer<typeof FieldEntityTypeSchema>;

export const FieldTypeSchema = z.enum([
  'text',
  'number',
  'date',
  'select',
  'multiselect',
]);

export type FieldType = z.infer<typeof FieldTypeSchema>;

export const FieldPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  entityType: FieldEntityTypeSchema,
  name: z.string().min(1),
  label: z.string().min(1),
  fieldType: FieldTypeSchema,
  options: z.array(z.string()).nullable(),
  isRequired: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
});

export type FieldProps = z.infer<typeof FieldPropsSchema>;

export class Field {
  private constructor(private props: FieldProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    entityType: FieldEntityType;
    name: string;
    label: string;
    fieldType: FieldType;
    options?: string[] | null;
    isRequired?: boolean;
    sortOrder?: number;
  }): Field {
    if (!input.name || input.name.trim().length === 0) {
      throw new InvariantViolation('Field name is required');
    }
    if (!input.label || input.label.trim().length === 0) {
      throw new InvariantViolation('Field label is required');
    }

    return new Field(
      FieldPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        entityType: input.entityType,
        name: input.name,
        label: input.label,
        fieldType: input.fieldType,
        options: input.options ?? null,
        isRequired: input.isRequired ?? false,
        sortOrder: input.sortOrder ?? 0,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: FieldProps): Field {
    return new Field(FieldPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get entityType(): FieldEntityType {
    return this.props.entityType;
  }
  get name(): string {
    return this.props.name;
  }
  get label(): string {
    return this.props.label;
  }
  get fieldType(): FieldType {
    return this.props.fieldType;
  }
  get options(): string[] | null {
    return this.props.options;
  }
  get isRequired(): boolean {
    return this.props.isRequired;
  }
  get sortOrder(): number {
    return this.props.sortOrder;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  // ---- Domain methods ----

  update(input: {
    label?: string;
    options?: string[] | null;
    isRequired?: boolean;
    sortOrder?: number;
  }): void {
    if (input.label !== undefined) {
      if (input.label.trim().length === 0) {
        throw new InvariantViolation('Field label must not be empty');
      }
      this.props.label = input.label;
    }
    if (input.options !== undefined) {
      this.props.options = input.options;
    }
    if (input.isRequired !== undefined) {
      this.props.isRequired = input.isRequired;
    }
    if (input.sortOrder !== undefined) {
      this.props.sortOrder = input.sortOrder;
    }
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<FieldProps> {
    return Object.freeze({ ...this.props });
  }
}
