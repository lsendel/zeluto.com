import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

export const TemplateTypeSchema = z.enum(['email', 'sms', 'push', 'page']);
export type TemplateType = z.infer<typeof TemplateTypeSchema>;

export const TemplatePropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  type: TemplateTypeSchema,
  category: z.string().nullable(),
  subject: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  bodyText: z.string().nullable(),
  bodyJson: z.record(z.string(), z.unknown()).nullable(),
  thumbnailUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type TemplateProps = z.infer<typeof TemplatePropsSchema>;

export class Template {
  private constructor(private props: TemplateProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    type: TemplateType;
    category?: string | null;
    subject?: string | null;
    bodyHtml?: string | null;
    bodyText?: string | null;
    bodyJson?: Record<string, unknown> | null;
    thumbnailUrl?: string | null;
    createdBy: string;
  }): Template {
    return new Template(
      TemplatePropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        type: input.type,
        category: input.category ?? null,
        subject: input.subject ?? null,
        bodyHtml: input.bodyHtml ?? null,
        bodyText: input.bodyText ?? null,
        bodyJson: input.bodyJson ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        isActive: true,
        createdBy: input.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: TemplateProps): Template {
    return new Template(TemplatePropsSchema.parse(props));
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
  get type(): TemplateType {
    return this.props.type;
  }
  get category(): string | null {
    return this.props.category;
  }
  get subject(): string | null {
    return this.props.subject;
  }
  get bodyHtml(): string | null {
    return this.props.bodyHtml;
  }
  get bodyText(): string | null {
    return this.props.bodyText;
  }
  get bodyJson(): Record<string, unknown> | null {
    return this.props.bodyJson;
  }
  get thumbnailUrl(): string | null {
    return this.props.thumbnailUrl;
  }
  get isActive(): boolean {
    return this.props.isActive;
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

  update(input: {
    name?: string;
    subject?: string | null;
    bodyHtml?: string | null;
    bodyText?: string | null;
    bodyJson?: Record<string, unknown> | null;
    category?: string | null;
    thumbnailUrl?: string | null;
  }): void {
    if (input.name !== undefined) {
      if (input.name.length === 0) {
        throw new InvariantViolation('Template name cannot be empty');
      }
      this.props.name = input.name;
    }
    if (input.subject !== undefined) this.props.subject = input.subject;
    if (input.bodyHtml !== undefined) this.props.bodyHtml = input.bodyHtml;
    if (input.bodyText !== undefined) this.props.bodyText = input.bodyText;
    if (input.bodyJson !== undefined) this.props.bodyJson = input.bodyJson;
    if (input.category !== undefined) this.props.category = input.category;
    if (input.thumbnailUrl !== undefined) this.props.thumbnailUrl = input.thumbnailUrl;
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
  toProps(): Readonly<TemplateProps> {
    return Object.freeze({ ...this.props });
  }
}
