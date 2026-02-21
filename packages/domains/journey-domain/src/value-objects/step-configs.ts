import { z } from 'zod';

export const ActionEmailConfigSchema = z.object({
  type: z.literal('send_email'),
  templateId: z.string().uuid(),
  subject: z.string(),
  fromName: z.string().optional(),
});

export type ActionEmailConfig = z.infer<typeof ActionEmailConfigSchema>;

export const ActionSmsConfigSchema = z.object({
  type: z.literal('send_sms'),
  templateId: z.string().uuid(),
  fromNumber: z.string().optional(),
});

export type ActionSmsConfig = z.infer<typeof ActionSmsConfigSchema>;

export const ActionPushConfigSchema = z.object({
  type: z.literal('send_push'),
  templateId: z.string().uuid(),
  title: z.string(),
});

export type ActionPushConfig = z.infer<typeof ActionPushConfigSchema>;

export const ActionLinkedInConfigSchema = z.object({
  type: z.literal('send_linkedin'),
  action: z.enum(['connection_request', 'message', 'inmail']),
  templateId: z.string().uuid(),
  note: z.string().max(300).optional(),
});

export type ActionLinkedInConfig = z.infer<typeof ActionLinkedInConfigSchema>;

export const ActionTaskConfigSchema = z.object({
  type: z.literal('create_task'),
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().uuid().optional(),
  dueDays: z.number().int().positive().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export type ActionTaskConfig = z.infer<typeof ActionTaskConfigSchema>;

export const DelayDurationConfigSchema = z.object({
  type: z.literal('delay'),
  duration: z.number().positive(),
  unit: z.enum(['minutes', 'hours', 'days']),
});

export type DelayDurationConfig = z.infer<typeof DelayDurationConfigSchema>;

export const SplitRandomConfigSchema = z.object({
  type: z.literal('split_random'),
  branches: z.array(
    z.object({
      label: z.string(),
      percentage: z.number().min(0).max(100),
    }),
  ),
});

export type SplitRandomConfig = z.infer<typeof SplitRandomConfigSchema>;

export const SplitConditionConfigSchema = z.object({
  type: z.literal('split_condition'),
  field: z.string(),
  operator: z.string(),
  value: z.unknown(),
});

export type SplitConditionConfig = z.infer<typeof SplitConditionConfigSchema>;

export const ExitConfigSchema = z.object({
  type: z.literal('exit'),
});

export type ExitConfig = z.infer<typeof ExitConfigSchema>;

export const GateConfigSchema = z.object({
  type: z.literal('gate'),
  eventType: z.string(),
  timeout: z.number().optional(), // hours
});

export type GateConfig = z.infer<typeof GateConfigSchema>;

/** Union of all known step configurations. */
export const StepConfigSchema = z.discriminatedUnion('type', [
  ActionEmailConfigSchema,
  ActionSmsConfigSchema,
  ActionPushConfigSchema,
  ActionLinkedInConfigSchema,
  ActionTaskConfigSchema,
  DelayDurationConfigSchema,
  SplitRandomConfigSchema,
  SplitConditionConfigSchema,
  ExitConfigSchema,
  GateConfigSchema,
]);

export type StepConfig = z.infer<typeof StepConfigSchema>;
