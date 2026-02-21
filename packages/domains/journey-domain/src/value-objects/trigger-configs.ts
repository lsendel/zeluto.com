import { z } from 'zod';

export const EventTriggerConfigSchema = z.object({
  type: z.literal('event'),
  eventType: z.string(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export type EventTriggerConfig = z.infer<typeof EventTriggerConfigSchema>;

export const SegmentTriggerConfigSchema = z.object({
  type: z.literal('segment'),
  segmentId: z.string().uuid(),
});

export type SegmentTriggerConfig = z.infer<typeof SegmentTriggerConfigSchema>;

export const ScoreTriggerConfigSchema = z.object({
  type: z.literal('score'),
  operator: z.enum(['gte', 'lte', 'eq']),
  threshold: z.number(),
});

export type ScoreTriggerConfig = z.infer<typeof ScoreTriggerConfigSchema>;

export const IntentTriggerConfigSchema = z.object({
  type: z.literal('intent'),
  intentType: z.string().min(1),
  minStrength: z.number().min(0).max(100).optional(),
});

export type IntentTriggerConfig = z.infer<typeof IntentTriggerConfigSchema>;

export const ApiTriggerConfigSchema = z.object({
  type: z.literal('api'),
});

export type ApiTriggerConfig = z.infer<typeof ApiTriggerConfigSchema>;

export const ScheduledTriggerConfigSchema = z.object({
  type: z.literal('scheduled'),
  cron: z.string(),
});

export type ScheduledTriggerConfig = z.infer<
  typeof ScheduledTriggerConfigSchema
>;

/** Union of all known trigger configurations. */
export const TriggerConfigSchema = z.discriminatedUnion('type', [
  EventTriggerConfigSchema,
  SegmentTriggerConfigSchema,
  ScoreTriggerConfigSchema,
  IntentTriggerConfigSchema,
  ApiTriggerConfigSchema,
  ScheduledTriggerConfigSchema,
]);

export type TriggerConfig = z.infer<typeof TriggerConfigSchema>;
