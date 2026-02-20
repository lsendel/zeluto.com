import { z } from 'zod';

export const UpdateWebhookCommandSchema = z.object({
  organizationId: z.string().uuid(),
  webhookId: z.string().uuid(),
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).optional(),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateWebhookCommand = z.infer<typeof UpdateWebhookCommandSchema>;

export function updateWebhookCommand(
  input: UpdateWebhookCommand,
): UpdateWebhookCommand {
  return UpdateWebhookCommandSchema.parse(input);
}
