import { z } from 'zod';
import { ConnectionProviderSchema } from '../entities/connection.js';

export const CreateConnectionCommandSchema = z.object({
  organizationId: z.string().uuid(),
  provider: ConnectionProviderSchema,
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()),
});

export type CreateConnectionCommand = z.infer<typeof CreateConnectionCommandSchema>;

export function createConnectionCommand(input: CreateConnectionCommand): CreateConnectionCommand {
  return CreateConnectionCommandSchema.parse(input);
}
