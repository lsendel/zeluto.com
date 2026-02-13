import { z } from 'zod';
import { ValidationError } from '@mauntic/domain-kernel';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const UsageRecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  resource: z.string(),
  periodStart: z.date(),
  periodEnd: z.date(),
  currentValue: z.number().int().min(0),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type UsageRecord = z.infer<typeof UsageRecordSchema>;

export const CreateUsageRecordSchema = z.object({
  organizationId: z.string().uuid(),
  resource: z.string(),
  periodStart: z.date(),
  periodEnd: z.date(),
  currentValue: z.number().int().min(0).default(0),
});

export type CreateUsageRecord = z.infer<typeof CreateUsageRecordSchema>;

export const IncrementUsageSchema = z.object({
  organizationId: z.string().uuid(),
  resource: z.string(),
  amount: z.number().int().min(1).default(1),
});

export type IncrementUsage = z.infer<typeof IncrementUsageSchema>;

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  stripeInvoiceId: z.string(),
  amount: z.number().int(),
  status: z.string(),
  periodStart: z.date().nullable(),
  periodEnd: z.date().nullable(),
  paidAt: z.date().nullable(),
  createdAt: z.date(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;

// ---------------------------------------------------------------------------
// Usage record value object helpers
// ---------------------------------------------------------------------------

/** Get the billing period boundaries for a given date (calendar month). */
export function getBillingPeriod(date: Date = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  // Set to end of day
  periodEnd.setHours(23, 59, 59, 999);
  return { periodStart, periodEnd };
}

/** Represents an in-memory usage record with mutation methods. */
export class UsageRecordAggregate {
  private _currentValue: number;

  private constructor(private readonly data: UsageRecord) {
    this._currentValue = data.currentValue;
  }

  static from(row: UsageRecord): UsageRecordAggregate {
    return new UsageRecordAggregate(row);
  }

  get id(): string {
    return this.data.id;
  }

  get organizationId(): string {
    return this.data.organizationId;
  }

  get resource(): string {
    return this.data.resource;
  }

  get currentValue(): number {
    return this._currentValue;
  }

  get periodStart(): Date {
    return this.data.periodStart;
  }

  get periodEnd(): Date {
    return this.data.periodEnd;
  }

  /** Increment the usage by a given amount. Returns the new value. */
  increment(amount: number = 1): number {
    if (amount < 1) {
      throw new ValidationError('Increment amount must be at least 1');
    }
    this._currentValue += amount;
    return this._currentValue;
  }

  /** Reset the usage counter to zero (e.g. monthly reset). Returns 0. */
  reset(): number {
    this._currentValue = 0;
    return this._currentValue;
  }

  /** The delta between the current value and the original persisted value. */
  get delta(): number {
    return this._currentValue - this.data.currentValue;
  }

  /** Whether this record has been mutated. */
  get isDirty(): boolean {
    return this._currentValue !== this.data.currentValue;
  }
}
