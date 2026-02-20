import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const CompanyPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  domain: z.string().nullable(),
  industry: z.string().nullable(),
  size: z.string().nullable(),
  customFields: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CompanyProps = z.infer<typeof CompanyPropsSchema>;

export class Company {
  private constructor(private props: CompanyProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    domain?: string | null;
    industry?: string | null;
    size?: string | null;
  }): Company {
    if (!input.name || input.name.trim().length === 0) {
      throw new InvariantViolation('Company name is required');
    }

    return new Company(
      CompanyPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        domain: input.domain ?? null,
        industry: input.industry ?? null,
        size: input.size ?? null,
        customFields: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: CompanyProps): Company {
    return new Company(CompanyPropsSchema.parse(props));
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
  get domain(): string | null {
    return this.props.domain;
  }
  get industry(): string | null {
    return this.props.industry;
  }
  get size(): string | null {
    return this.props.size;
  }
  get customFields(): Record<string, unknown> {
    return this.props.customFields;
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
    domain?: string | null;
    industry?: string | null;
    size?: string | null;
  }): void {
    if (input.name !== undefined) {
      if (input.name.trim().length === 0) {
        throw new InvariantViolation('Company name must not be empty');
      }
      this.props.name = input.name;
    }
    if (input.domain !== undefined) {
      this.props.domain = input.domain;
    }
    if (input.industry !== undefined) {
      this.props.industry = input.industry;
    }
    if (input.size !== undefined) {
      this.props.size = input.size;
    }
    this.props.updatedAt = new Date();
  }

  setCustomField(key: string, value: unknown): void {
    this.props.customFields = { ...this.props.customFields, [key]: value };
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<CompanyProps> {
    return Object.freeze({ ...this.props });
  }
}
