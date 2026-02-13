import { z } from 'zod';
import { ConnectionStatusSchema } from '../entities/connection.js';

export const UpdateConnectionCommandSchema = z.object({
  organizationId: z.string().uuid(),
  connectionId: z.string().uuid(),
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  status: ConnectionStatusSchema.optional(),
});

export type UpdateConnectionCommand = z.infer<typeof UpdateConnectionCommandSchema>;

export function updateConnectionCommand(input: UpdateConnectionCommand): UpdateConnectionCommand {
  return UpdateConnectionCommandSchema.parse(input);
}
