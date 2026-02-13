import { z } from 'zod';

export const CreateCompanyCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
});

export type CreateCompanyCommand = z.infer<typeof CreateCompanyCommandSchema>;

export function createCompanyCommand(input: CreateCompanyCommand): CreateCompanyCommand {
  return CreateCompanyCommandSchema.parse(input);
}
