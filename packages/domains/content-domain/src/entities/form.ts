import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const FormFieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    'text',
    'email',
    'tel',
    'number',
    'textarea',
    'select',
    'checkbox',
    'radio',
    'hidden',
    'date',
  ]),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  options: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .optional(),
  validation: z
    .object({
      pattern: z.string().optional(),
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    })
    .optional(),
  order: z.number().default(0),
});

export type FormField = z.infer<typeof FormFieldSchema>;

export const SuccessActionSchema = z.enum(['redirect', 'message']);
export type SuccessAction = z.infer<typeof SuccessActionSchema>;

export const FormPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  fields: z.array(FormFieldSchema),
  successAction: SuccessActionSchema,
  successUrl: z.string().nullable(),
  successMessage: z.string().nullable(),
  isActive: z.boolean(),
  submissionCount: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type FormProps = z.infer<typeof FormPropsSchema>;

export class Form {
  private constructor(private props: FormProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    description?: string | null;
    fields: FormField[];
    successAction?: SuccessAction;
    successUrl?: string | null;
    successMessage?: string | null;
  }): Form {
    return new Form(
      FormPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        description: input.description ?? null,
        fields: input.fields,
        successAction: input.successAction ?? 'message',
        successUrl: input.successUrl ?? null,
        successMessage:
          input.successMessage ?? 'Thank you for your submission!',
        isActive: true,
        submissionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: FormProps): Form {
    return new Form(FormPropsSchema.parse(props));
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
  get fields(): FormField[] {
    return this.props.fields;
  }
  get successAction(): SuccessAction {
    return this.props.successAction;
  }
  get successUrl(): string | null {
    return this.props.successUrl;
  }
  get successMessage(): string | null {
    return this.props.successMessage;
  }
  get isActive(): boolean {
    return this.props.isActive;
  }
  get submissionCount(): number {
    return this.props.submissionCount;
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
    fields?: FormField[];
    successAction?: SuccessAction;
    successUrl?: string | null;
    successMessage?: string | null;
  }): void {
    if (input.name !== undefined) {
      if (input.name.length === 0) {
        throw new InvariantViolation('Form name cannot be empty');
      }
      this.props.name = input.name;
    }
    if (input.description !== undefined)
      this.props.description = input.description;
    if (input.fields !== undefined) this.props.fields = input.fields;
    if (input.successAction !== undefined)
      this.props.successAction = input.successAction;
    if (input.successUrl !== undefined)
      this.props.successUrl = input.successUrl;
    if (input.successMessage !== undefined)
      this.props.successMessage = input.successMessage;
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

  incrementSubmissionCount(): void {
    this.props.submissionCount += 1;
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<FormProps> {
    return Object.freeze({ ...this.props });
  }
}
