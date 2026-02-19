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
  minScore: z.number().int().min(0).max(100).nullable(),
  maxScore: z.number().int().min(0).max(100).nullable(),
  grades: z.array(z.string()).nullable(),
  scheduledAt: z.coerce.date().nullable(),
  startedAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  recipientCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
  deliveredCount: z.number().int().nonnegative(),
  openCount: z.number().int().nonnegative(),
  clickCount: z.number().int().nonnegative(),
  bounceCount: z.number().int().nonnegative(),
  complaintCount: z.number().int().nonnegative(),
  unsubscribeCount: z.number().int().nonnegative(),
  openRate: z.number().nonnegative(),
  clickRate: z.number().nonnegative(),
  lastEventAt: z.coerce.date().nullable(),
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
    minScore?: number | null;
    maxScore?: number | null;
    grades?: string[] | null;
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
        minScore: input.minScore ?? null,
        maxScore: input.maxScore ?? null,
        grades: input.grades ?? null,
        scheduledAt: null,
        startedAt: null,
        completedAt: null,
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        deliveredCount: 0,
        openCount: 0,
        clickCount: 0,
        bounceCount: 0,
        complaintCount: 0,
        unsubscribeCount: 0,
        openRate: 0,
        clickRate: 0,
        lastEventAt: null,
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
  get minScore(): number | null {
    return this.props.minScore;
  }
  get maxScore(): number | null {
    return this.props.maxScore;
  }
  get grades(): string[] | null {
    return this.props.grades;
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
  get deliveredCount(): number {
    return this.props.deliveredCount;
  }
  get openCount(): number {
    return this.props.openCount;
  }
  get clickCount(): number {
    return this.props.clickCount;
  }
  get bounceCount(): number {
    return this.props.bounceCount;
  }
  get complaintCount(): number {
    return this.props.complaintCount;
  }
  get unsubscribeCount(): number {
    return this.props.unsubscribeCount;
  }
  get openRate(): number {
    return this.props.openRate;
  }
  get clickRate(): number {
    return this.props.clickRate;
  }
  get lastEventAt(): Date | null {
    return this.props.lastEventAt;
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
    minScore?: number | null;
    maxScore?: number | null;
    grades?: string[] | null;
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
    if (input.minScore !== undefined) {
      this.props.minScore = input.minScore;
    }
    if (input.maxScore !== undefined) {
      this.props.maxScore = input.maxScore;
    }
    if (input.grades !== undefined) {
      this.props.grades = input.grades;
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
    delivered?: number;
    opens?: number;
    clicks?: number;
    bounces?: number;
    complaints?: number;
    unsubscribes?: number;
    openRate?: number;
    clickRate?: number;
    lastEventAt?: Date | null;
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
    if (input.delivered !== undefined) {
      this.props.deliveredCount = input.delivered;
    }
    if (input.opens !== undefined) {
      this.props.openCount = input.opens;
    }
    if (input.clicks !== undefined) {
      this.props.clickCount = input.clicks;
    }
    if (input.bounces !== undefined) {
      this.props.bounceCount = input.bounces;
    }
    if (input.complaints !== undefined) {
      this.props.complaintCount = input.complaints;
    }
    if (input.unsubscribes !== undefined) {
      this.props.unsubscribeCount = input.unsubscribes;
    }
    if (input.openRate !== undefined) {
      this.props.openRate = input.openRate;
    }
    if (input.clickRate !== undefined) {
      this.props.clickRate = input.clickRate;
    }
    if (input.lastEventAt !== undefined) {
      this.props.lastEventAt = input.lastEventAt;
    }
    this.props.updatedAt = new Date();
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<CampaignProps> {
    return Object.freeze({ ...this.props });
  }
}
