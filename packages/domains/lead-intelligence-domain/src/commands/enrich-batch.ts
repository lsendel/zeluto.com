import { z } from 'zod';

export const EnrichBatchCommandSchema = z.object({
  organizationId: z.string().uuid(),
  contactIds: z.array(z.string().uuid()).min(1).max(100),
  fields: z.array(z.string()).optional(),
});

export type EnrichBatchCommand = z.infer<typeof EnrichBatchCommandSchema>;

export function enrichBatchCommand(input: EnrichBatchCommand): EnrichBatchCommand {
  return EnrichBatchCommandSchema.parse(input);
}
