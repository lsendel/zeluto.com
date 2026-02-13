import { z } from 'zod';

export const GetSegmentQuerySchema = z.object({
  organizationId: z.string().uuid(),
  segmentId: z.string().uuid(),
});

export type GetSegmentQuery = z.infer<typeof GetSegmentQuerySchema>;

export function getSegmentQuery(input: GetSegmentQuery): GetSegmentQuery {
  return GetSegmentQuerySchema.parse(input);
}
