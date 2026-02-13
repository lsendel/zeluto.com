import { z } from 'zod';
import { PointEventTypeSchema } from '../entities/point-rule.js';

export const AwardPointsCommandSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  eventType: PointEventTypeSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AwardPointsCommand = z.infer<typeof AwardPointsCommandSchema>;

export function awardPointsCommand(input: AwardPointsCommand): AwardPointsCommand {
  return AwardPointsCommandSchema.parse(input);
}
