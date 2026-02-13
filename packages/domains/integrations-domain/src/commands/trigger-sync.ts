import { z } from 'zod';
import { SyncDirectionSchema } from '../entities/sync-job.js';

export const TriggerSyncCommandSchema = z.object({
  organizationId: z.string().uuid(),
  connectionId: z.string().uuid(),
  direction: SyncDirectionSchema,
});

export type TriggerSyncCommand = z.infer<typeof TriggerSyncCommandSchema>;

export function triggerSyncCommand(input: TriggerSyncCommand): TriggerSyncCommand {
  return TriggerSyncCommandSchema.parse(input);
}
