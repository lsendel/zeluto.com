import { z } from 'zod';

export const ReEntryRuleSchema = z.object({
  type: z.enum(['always', 'once', 'cooldown']),
  cooldownDays: z.number().int().positive().optional(),
});

export type ReEntryRule = z.infer<typeof ReEntryRuleSchema>;

export const FrequencyCapSchema = z.object({
  maxCount: z.number().int().positive(),
  windowDays: z.number().int().positive(),
});

export type FrequencyCap = z.infer<typeof FrequencyCapSchema>;

export const JourneyGoalSchema = z.object({
  type: z.enum(['event', 'score', 'page_visit']),
  config: z.record(z.string(), z.unknown()),
  exitOnComplete: z.boolean().default(false),
});

export type JourneyGoal = z.infer<typeof JourneyGoalSchema>;

export const JourneySettingsSchema = z.object({
  reEntry: ReEntryRuleSchema.default({ type: 'once' }),
  frequencyCap: FrequencyCapSchema.nullable().default(null),
  goal: JourneyGoalSchema.nullable().default(null),
});

export type JourneySettings = z.infer<typeof JourneySettingsSchema>;
