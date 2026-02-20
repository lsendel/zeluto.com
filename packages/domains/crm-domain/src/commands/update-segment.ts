import { z } from 'zod';

export const UpdateSegmentCommandSchema = z.object({
  organizationId: z.string().uuid(),
  segmentId: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  filterCriteria: z.unknown().optional(),
});

export type UpdateSegmentCommand = z.infer<typeof UpdateSegmentCommandSchema>;

export function updateSegmentCommand(
  input: UpdateSegmentCommand,
): UpdateSegmentCommand {
  return UpdateSegmentCommandSchema.parse(input);
}
