import { z } from 'zod';
import { SegmentTypeSchema } from '../entities/segment.js';

export const CreateSegmentCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  type: SegmentTypeSchema,
  description: z.string().optional(),
  filterCriteria: z.unknown().optional(),
});

export type CreateSegmentCommand = z.infer<typeof CreateSegmentCommandSchema>;

export function createSegmentCommand(
  input: CreateSegmentCommand,
): CreateSegmentCommand {
  return CreateSegmentCommandSchema.parse(input);
}
