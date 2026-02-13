import { z } from 'zod';

export const UpdateReportCommandSchema = z.object({
  organizationId: z.string().uuid(),
  reportId: z.string().uuid(),
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateReportCommand = z.infer<typeof UpdateReportCommandSchema>;

export function updateReportCommand(input: UpdateReportCommand): UpdateReportCommand {
  return UpdateReportCommandSchema.parse(input);
}
