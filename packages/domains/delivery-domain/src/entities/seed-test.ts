import { z } from 'zod';

export const SeedProviderSchema = z.enum([
  'gmail',
  'outlook',
  'yahoo',
  'icloud',
  'aol',
  'custom',
]);
export type SeedProvider = z.infer<typeof SeedProviderSchema>;

export const InboxPlacementSchema = z.enum([
  'inbox',
  'spam',
  'missing',
  'pending',
]);
export type InboxPlacement = z.infer<typeof InboxPlacementSchema>;

export const SeedResultSchema = z.object({
  seedAddress: z.string().email(),
  provider: SeedProviderSchema,
  placement: InboxPlacementSchema,
  receivedAt: z.coerce.date().nullable(),
  headers: z.record(z.string(), z.string()).nullable(),
});
export type SeedResult = z.infer<typeof SeedResultSchema>;

export const SeedTestStatusSchema = z.enum([
  'pending',
  'sending',
  'waiting',
  'completed',
  'failed',
]);
export type SeedTestStatus = z.infer<typeof SeedTestStatusSchema>;

export const SeedTestPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  sendingDomainId: z.string().uuid().nullable(),
  subjectLine: z.string(),
  htmlBody: z.string(),
  fromAddress: z.string().email(),
  status: SeedTestStatusSchema,
  results: z.array(SeedResultSchema),
  inboxRate: z.number().min(0).max(100).nullable(),
  spamRate: z.number().min(0).max(100).nullable(),
  missingRate: z.number().min(0).max(100).nullable(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export type SeedTestProps = z.infer<typeof SeedTestPropsSchema>;

export class SeedTest {
  private constructor(private props: SeedTestProps) {}

  static create(input: {
    organizationId: string;
    sendingDomainId?: string | null;
    subjectLine: string;
    htmlBody: string;
    fromAddress: string;
    seedAddresses: Array<{ address: string; provider: SeedProvider }>;
  }): SeedTest {
    const results: SeedResult[] = input.seedAddresses.map((seed) => ({
      seedAddress: seed.address,
      provider: seed.provider,
      placement: 'pending' as const,
      receivedAt: null,
      headers: null,
    }));

    return new SeedTest(
      SeedTestPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        sendingDomainId: input.sendingDomainId ?? null,
        subjectLine: input.subjectLine,
        htmlBody: input.htmlBody,
        fromAddress: input.fromAddress,
        status: 'pending',
        results,
        inboxRate: null,
        spamRate: null,
        missingRate: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: SeedTestProps): SeedTest {
    return new SeedTest(SeedTestPropsSchema.parse(props));
  }

  get id() {
    return this.props.id;
  }
  get organizationId() {
    return this.props.organizationId;
  }
  get status() {
    return this.props.status;
  }
  get results() {
    return this.props.results;
  }
  get inboxRate() {
    return this.props.inboxRate;
  }
  get spamRate() {
    return this.props.spamRate;
  }
  get missingRate() {
    return this.props.missingRate;
  }

  markSending(): void {
    this.props.status = 'sending';
    this.props.startedAt = new Date();
  }

  markWaiting(): void {
    this.props.status = 'waiting';
  }

  recordResult(
    seedAddress: string,
    placement: 'inbox' | 'spam' | 'missing',
    headers?: Record<string, string>,
  ): void {
    const result = this.props.results.find(
      (r) => r.seedAddress === seedAddress,
    );
    if (!result) return;
    result.placement = placement;
    result.receivedAt = placement !== 'missing' ? new Date() : null;
    result.headers = headers ?? null;

    this.recalculateRates();
  }

  markCompleted(): void {
    // Mark any remaining 'pending' results as 'missing'
    for (const result of this.props.results) {
      if (result.placement === 'pending') {
        result.placement = 'missing';
      }
    }
    this.recalculateRates();
    this.props.status = 'completed';
    this.props.completedAt = new Date();
  }

  markFailed(): void {
    this.props.status = 'failed';
    this.props.completedAt = new Date();
  }

  private recalculateRates(): void {
    const total = this.props.results.length;
    if (total === 0) return;

    const inbox = this.props.results.filter(
      (r) => r.placement === 'inbox',
    ).length;
    const spam = this.props.results.filter(
      (r) => r.placement === 'spam',
    ).length;
    const missing = this.props.results.filter(
      (r) => r.placement === 'missing',
    ).length;

    this.props.inboxRate = Math.round((inbox / total) * 100);
    this.props.spamRate = Math.round((spam / total) * 100);
    this.props.missingRate = Math.round((missing / total) * 100);
  }

  toProps(): Readonly<SeedTestProps> {
    return Object.freeze({ ...this.props });
  }
}
