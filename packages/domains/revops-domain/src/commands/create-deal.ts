import { z } from 'zod';

export const CreateDealCommandSchema = z.object({
  organizationId: z.string().uuid(),
  contactId: z.string().uuid(),
  name: z.string(),
  value: z.number().min(0).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  accountId: z.string().uuid().optional(),
  assignedRep: z.string().uuid().optional(),
  expectedCloseAt: z.string().optional(),
});

export type CreateDealCommand = z.infer<typeof CreateDealCommandSchema>;

export function createDealCommand(input: CreateDealCommand): CreateDealCommand {
  return CreateDealCommandSchema.parse(input);
}
