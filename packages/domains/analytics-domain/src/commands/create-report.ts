import { z } from 'zod';
import { ReportTypeSchema } from '../entities/report.js';

export const CreateReportCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  type: ReportTypeSchema,
  config: z.record(z.string(), z.unknown()).optional(),
});

export type CreateReportCommand = z.infer<typeof CreateReportCommandSchema>;

export function createReportCommand(
  input: CreateReportCommand,
): CreateReportCommand {
  return CreateReportCommandSchema.parse(input);
}
