import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

export const LandingPagePropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  htmlContent: z.string().nullable(),
  metaDescription: z.string().nullable(),
  templateId: z.string().uuid().nullable(),
  isPublished: z.boolean(),
  publishedAt: z.coerce.date().nullable(),
  visitCount: z.number(),
  conversionCount: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type LandingPageProps = z.infer<typeof LandingPagePropsSchema>;

export class LandingPage {
  private constructor(private props: LandingPageProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    title: string;
    slug: string;
    htmlContent?: string | null;
    metaDescription?: string | null;
    templateId?: string | null;
  }): LandingPage {
    return new LandingPage(
      LandingPagePropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        title: input.title,
        slug: input.slug,
        htmlContent: input.htmlContent ?? null,
        metaDescription: input.metaDescription ?? null,
        templateId: input.templateId ?? null,
        isPublished: false,
        publishedAt: null,
        visitCount: 0,
        conversionCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: LandingPageProps): LandingPage {
    return new LandingPage(LandingPagePropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get title(): string {
    return this.props.title;
  }
  get slug(): string {
    return this.props.slug;
  }
  get htmlContent(): string | null {
    return this.props.htmlContent;
  }
  get metaDescription(): string | null {
    return this.props.metaDescription;
  }
  get templateId(): string | null {
    return this.props.templateId;
  }
  get isPublished(): boolean {
    return this.props.isPublished;
  }
  get publishedAt(): Date | null {
    return this.props.publishedAt;
  }
  get visitCount(): number {
    return this.props.visitCount;
  }
  get conversionCount(): number {
    return this.props.conversionCount;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // ---- Domain methods ----

  update(input: {
    title?: string;
    slug?: string;
    htmlContent?: string | null;
    metaDescription?: string | null;
    templateId?: string | null;
  }): void {
    if (input.title !== undefined) {
      if (input.title.length === 0) {
        throw new InvariantViolation('Landing page title cannot be empty');
      }
      this.props.title = input.title;
    }
    if (input.slug !== undefined) {
      if (input.slug.length === 0) {
        throw new InvariantViolation('Landing page slug cannot be empty');
      }
      this.props.slug = input.slug;
    }
    if (input.htmlContent !== undefined) this.props.htmlContent = input.htmlContent;
    if (input.metaDescription !== undefined) this.props.metaDescription = input.metaDescription;
    if (input.templateId !== undefined) this.props.templateId = input.templateId;
    this.props.updatedAt = new Date();
  }

  publish(): void {
    if (!this.props.htmlContent && !this.props.templateId) {
      throw new InvariantViolation('Cannot publish a landing page without content or a template');
    }
    this.props.isPublished = true;
    this.props.publishedAt = new Date();
    this.props.updatedAt = new Date();
  }

  unpublish(): void {
    this.props.isPublished = false;
    this.props.updatedAt = new Date();
  }

  recordVisit(): void {
    this.props.visitCount += 1;
  }

  recordConversion(): void {
    this.props.conversionCount += 1;
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<LandingPageProps> {
    return Object.freeze({ ...this.props });
  }
}
