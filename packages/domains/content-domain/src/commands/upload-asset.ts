import { z } from 'zod';

export const UploadAssetCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number(),
  r2Key: z.string().min(1),
  folder: z.string().optional(),
  createdBy: z.string().uuid(),
});

export type UploadAssetCommand = z.infer<typeof UploadAssetCommandSchema>;

export function uploadAssetCommand(input: UploadAssetCommand): UploadAssetCommand {
  return UploadAssetCommandSchema.parse(input);
}
