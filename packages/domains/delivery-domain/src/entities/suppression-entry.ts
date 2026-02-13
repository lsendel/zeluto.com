import { z } from 'zod';

export const SuppressionReasonSchema = z.enum([
  'bounce',
  'complaint',
  'unsubscribe',
  'manual',
]);
export type SuppressionReason = z.infer<typeof SuppressionReasonSchema>;

export const SuppressionEntryPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  reason: SuppressionReasonSchema,
  source: z.string().nullable(),
  createdAt: z.coerce.date(),
});

export type SuppressionEntryProps = z.infer<typeof SuppressionEntryPropsSchema>;

export class SuppressionEntry {
  private constructor(private props: SuppressionEntryProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    email: string;
    reason: SuppressionReason;
    source?: string;
  }): SuppressionEntry {
    return new SuppressionEntry(
      SuppressionEntryPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        email: input.email,
        reason: input.reason,
        source: input.source ?? null,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: SuppressionEntryProps): SuppressionEntry {
    return new SuppressionEntry(SuppressionEntryPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get email(): string {
    return this.props.email;
  }
  get reason(): SuppressionReason {
    return this.props.reason;
  }
  get source(): string | null {
    return this.props.source;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<SuppressionEntryProps> {
    return Object.freeze({ ...this.props });
  }
}
