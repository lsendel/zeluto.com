import { z } from 'zod';
import { InvariantViolation } from '@mauntic/domain-kernel';

export const CampaignStatusSchema = z.enum([
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
  'canceled',
]);

export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const CampaignTypeSchema = z.enum(['email', 'sms', 'push', 'multichannel']);
export type CampaignType = z.infer<typeof CampaignTypeSchema>;

export const CampaignPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  type: CampaignTypeSchema,
  status: CampaignStatusSchema,
  subject: z.string().nullable(),
  templateId: z.string().uuid().nullable(),
  segmentId: z.string().uuid().nullable(),
  scheduledAt: z.coerce.date().nullable(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  recipientCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  openRate: z.number().nonnegative(),
  clickRate: z.number().nonnegative(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type CampaignProps = z.infer<typeof CampaignPropsSchema>;

export class Campaign {
  private constructor(private props: CampaignProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    description?: string | null;
    type: CampaignType;
    subject?: string | null;
    templateId?: string | null;
    segmentId?: string | null;
    createdBy: string;
  }): Campaign {
    if (!input.name || input.name.trim().length === 0) {
      throw new InvariantViolation('Campaign name is required');
    }

    return new Campaign(
      CampaignPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name.trim(),
        description: input.description ?? null,
        type: input.type,
        status: 'draft',
        subject: input.subject ?? null,
        templateId: input.templateId ?? null,
        segmentId: input.segmentId ?? null,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        openRate: 0,
        clickRate: 0,
        createdBy: input.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    );
  }

  static reconstitute(props: CampaignProps): Campaign {
    return new Campaign(CampaignPropsSchema.parse(props));
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
  get type(): CampaignType {
    return this.props.type;
  }
  get status(): CampaignStatus {
    return this.props.status;
  }
  get subject(): string | null {
    return this.props.subject;
  }
  get templateId(): string | null {
    return this.props.templateId;
  }
  get segmentId(): string | null {
    return this.props.segmentId;
  }
  get scheduledAt(): Date | null {
    return this.props.scheduledAt;
  }
  get startedAt(): Date | null {
    return this.props.startedAt;
  }
  get completedAt(): Date | null {
    return this.props.completedAt;
  }
  get recipientCount(): number {
    return this.props.recipientCount;
  }
  get sentCount(): number {
    return this.props.sentCount;
  }
  get failedCount(): number {
    return this.props.failedCount;
  }
  get openRate(): number {
    return this.props.openRate;
  }
  get clickRate(): number {
    return this.props.clickRate;
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
    description?: string | null;
    subject?: string | null;
    templateId?: string | null;
    segmentId?: string | null;
  }): void {
    if (this.props.status !== 'draft') {
      throw new InvariantViolation(
        `Cannot update campaign in status "${this.props.status}"; must be in "draft"`,
      );
    }
    if (input.name !== undefined) {
      if (!input.name || input.name.trim().length === 0) {
        throw new InvariantViolation('Campaign name cannot be empty');
      }
      this.props.name = input.name.trim();
    }
    if (input.description !== undefined) {
      this.props.description = input.description;
    }
    if (input.subject !== undefined) {
      this.props.subject = input.subject;
    }
    if (input.templateId !== undefined) {
      this.props.templateId = input.templateId;
    }
    if (input.segmentId !== undefined) {
      this.props.segmentId = input.segmentId;
    }
    this.props.updatedAt = new Date();
  }

  schedule(date: Date): void {
    if (this.props.status !== 'draft') {
      throw new InvariantViolation(
        `Cannot schedule campaign from status "${this.props.status}"; must be in "draft"`,
      );
    }
    if (!this.props.segmentId) {
      throw new InvariantViolation('Cannot schedule campaign without a segment');
    }
    if (!this.props.templateId) {
      throw new InvariantViolation('Cannot schedule campaign without a template');
    }
    if (date <= new Date()) {
      throw new InvariantViolation('Scheduled date must be in the future');
    }
    this.props.scheduledAt = date;
    this.props.status = 'scheduled';
    this.props.updatedAt = new Date();
  }

  send(): void {
    if (this.props.status !== 'draft' && this.props.status !== 'scheduled') {
      throw new InvariantViolation(
        `Cannot send campaign from status "${this.props.status}"; must be "draft" or "scheduled"`,
      );
    }
    if (!this.props.segmentId) {
      throw new InvariantViolation('Cannot send campaign without a segment');
    }
    if (!this.props.templateId) {
      throw new InvariantViolation('Cannot send campaign without a template');
    }
    this.props.status = 'sending';
    this.props.startedAt = new Date();
    this.props.updatedAt = new Date();
  }

  pause(): void {
    if (this.props.status !== 'sending') {
      throw new InvariantViolation(
        `Cannot pause campaign from status "${this.props.status}"; must be "sending"`,
      );
    }
    this.props.status = 'paused';
    this.props.updatedAt = new Date();
  }

  cancel(): void {
    if (
      this.props.status !== 'draft' &&
      this.props.status !== 'scheduled' &&
      this.props.status !== 'sending' &&
      this.props.status !== 'paused'
    ) {
      throw new InvariantViolation(
        `Cannot cancel campaign from status "${this.props.status}"`,
      );
    }
    this.props.status = 'canceled';
    this.props.updatedAt = new Date();
  }

  resume(): void {
    if (this.props.status !== 'paused') {
      throw new InvariantViolation(
        `Cannot resume campaign from status "${this.props.status}"; must be "paused"`,
      );
    }
    this.props.status = 'sending';
    this.props.updatedAt = new Date();
  }

  markCompleted(): void {
    if (this.props.status !== 'sending') {
      throw new InvariantViolation(
        `Cannot complete campaign from status "${this.props.status}"; must be "sending"`,
      );
    }
    this.props.status = 'sent';
    this.props.completedAt = new Date();
    this.props.updatedAt = new Date();
  }

  updateStats(input: {
    recipientCount?: number;
    sent?: number;
    failed?: number;
    opens?: number;
    clicks?: number;
  }): void {
    if (input.recipientCount !== undefined) {
      this.props.recipientCount = input.recipientCount;
    }
    if (input.sent !== undefined) {
      this.props.sentCount = input.sent;
    }
    if (input.failed !== undefined) {
      this.props.failedCount = input.failed;
    }
    if (input.opens !== undefined && this.props.sentCount > 0) {
      this.props.openRate = (input.opens / this.props.sentCount) * 100;
    }
    if (input.clicks !== undefined && this.props.sentCount > 0) {
      this.props.clickRate = (input.clicks / this.props.sentCount) * 100;
    }
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<CampaignProps> {
    return Object.freeze({ ...this.props });
  }
}
