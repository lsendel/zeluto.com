import { z } from 'zod';

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
