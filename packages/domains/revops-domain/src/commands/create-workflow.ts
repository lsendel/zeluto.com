import { z } from 'zod';

export const CreateWorkflowCommandSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string(),
  trigger: z.enum(['deal_created', 'stage_changed', 'deal_won', 'deal_lost', 'inactivity', 'score_changed', 'time_in_stage']),
  conditions: z.record(z.unknown()).optional(),
  actions: z.array(z.object({
    type: z.enum(['send_email', 'create_task', 'update_field', 'assign_owner', 'notify', 'call_webhook', 'add_to_sequence', 'move_stage']),
    config: z.record(z.unknown()),
  })),
  enabled: z.boolean().optional(),
});

export type CreateWorkflowCommand = z.infer<typeof CreateWorkflowCommandSchema>;

export function createWorkflowCommand(input: CreateWorkflowCommand): CreateWorkflowCommand {
  return CreateWorkflowCommandSchema.parse(input);
}
