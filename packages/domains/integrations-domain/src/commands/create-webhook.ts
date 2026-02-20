import { z } from 'zod';

export const CreateWebhookCommandSchema = z.object({
  organizationId: z.string().uuid(),
  url: z.string().url(),
  events: z.array(z.string().min(1)),
  secret: z.string().optional(),
});

export type CreateWebhookCommand = z.infer<typeof CreateWebhookCommandSchema>;

export function createWebhookCommand(
  input: CreateWebhookCommand,
): CreateWebhookCommand {
  return CreateWebhookCommandSchema.parse(input);
}
