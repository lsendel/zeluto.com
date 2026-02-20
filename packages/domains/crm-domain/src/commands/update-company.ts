import { z } from 'zod';

export const UpdateCompanyCommandSchema = z.object({
  organizationId: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).optional(),
  domain: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
});

export type UpdateCompanyCommand = z.infer<typeof UpdateCompanyCommandSchema>;

export function updateCompanyCommand(
  input: UpdateCompanyCommand,
): UpdateCompanyCommand {
  return UpdateCompanyCommandSchema.parse(input);
}
