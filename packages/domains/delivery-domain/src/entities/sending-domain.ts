import { InvariantViolation } from '@mauntic/domain-kernel';
import { z } from 'zod';

export const SendingDomainStatusSchema = z.enum([
  'pending',
  'verified',
  'failed',
]);
export type SendingDomainStatus = z.infer<typeof SendingDomainStatusSchema>;

export const DnsRecordSchema = z.object({
  type: z.string(),
  name: z.string(),
  value: z.string(),
  verified: z.boolean().optional(),
});

export type DnsRecord = z.infer<typeof DnsRecordSchema>;

export const SendingDomainPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  domain: z.string().min(1),
  status: SendingDomainStatusSchema,
  dnsRecords: z.array(DnsRecordSchema).nullable(),
  verifiedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type SendingDomainProps = z.infer<typeof SendingDomainPropsSchema>;

export class SendingDomain {
  private constructor(private props: SendingDomainProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    domain: string;
  }): SendingDomain {
    if (!input.domain || input.domain.trim().length === 0) {
      throw new InvariantViolation('Domain is required');
    }

    return new SendingDomain(
      SendingDomainPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        domain: input.domain.toLowerCase(),
        status: 'pending',
        dnsRecords: null,
        verifiedAt: null,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: SendingDomainProps): SendingDomain {
    return new SendingDomain(SendingDomainPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get domain(): string {
    return this.props.domain;
  }
  get status(): SendingDomainStatus {
    return this.props.status;
  }
  get dnsRecords(): DnsRecord[] | null {
    return this.props.dnsRecords;
  }
  get verifiedAt(): Date | null {
    return this.props.verifiedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  // ---- Domain methods ----

  verify(dnsRecords: DnsRecord[]): void {
    if (this.props.status === 'verified') {
      throw new InvariantViolation('Domain is already verified');
    }
    this.props.dnsRecords = dnsRecords;
    this.props.status = 'verified';
    this.props.verifiedAt = new Date();
  }

  markFailed(): void {
    if (this.props.status === 'verified') {
      throw new InvariantViolation('Cannot mark a verified domain as failed');
    }
    this.props.status = 'failed';
  }

  isPending(): boolean {
    return this.props.status === 'pending';
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<SendingDomainProps> {
    return Object.freeze({ ...this.props });
  }
}
