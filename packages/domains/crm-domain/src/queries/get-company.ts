import { z } from 'zod';

export const GetCompanyQuerySchema = z.object({
  organizationId: z.string().uuid(),
  companyId: z.string().uuid(),
});

export type GetCompanyQuery = z.infer<typeof GetCompanyQuerySchema>;

export function getCompanyQuery(input: GetCompanyQuery): GetCompanyQuery {
  return GetCompanyQuerySchema.parse(input);
}
