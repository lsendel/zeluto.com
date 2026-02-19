export type WorkflowTrigger =
  | 'deal_created' | 'stage_changed' | 'deal_won' | 'deal_lost'
  | 'inactivity' | 'score_changed' | 'time_in_stage';

export type WorkflowActionType =
  | 'send_email' | 'create_task' | 'update_field' | 'assign_owner'
  | 'notify' | 'call_webhook' | 'add_to_sequence' | 'move_stage';

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  organizationId: string;
  name: string;
  trigger: WorkflowTrigger;
  conditions?: Record<string, unknown>;
  actions: WorkflowAction[];
  enabled: boolean;
}

export interface WorkflowContext {
  organizationId: string;
  trigger: WorkflowTrigger;
  dealId?: string;
  contactId?: string;
  data: Record<string, unknown>;
}

export interface WorkflowExecutionResult {
  workflowId: string;
  success: boolean;
  actionsExecuted: number;
  error?: string;
}

export interface ActionExecutor {
  execute(action: WorkflowAction, context: WorkflowContext): Promise<void>;
}

export class WorkflowEngine {
  constructor(private readonly actionExecutor: ActionExecutor) {}

  async evaluate(
    workflows: WorkflowDefinition[],
    context: WorkflowContext,
  ): Promise<WorkflowExecutionResult[]> {
    const results: WorkflowExecutionResult[] = [];

    const matching = workflows.filter(
      w => w.enabled && w.trigger === context.trigger && this.matchConditions(w.conditions, context),
    );

    for (const workflow of matching) {
      const result = await this.executeWorkflow(workflow, context);
      results.push(result);
    }

    return results;
  }

  private async executeWorkflow(
    workflow: WorkflowDefinition,
    context: WorkflowContext,
  ): Promise<WorkflowExecutionResult> {
    let actionsExecuted = 0;

    try {
      for (const action of workflow.actions) {
        await this.actionExecutor.execute(action, context);
        actionsExecuted++;
      }

      return {
        workflowId: workflow.id,
        success: true,
        actionsExecuted,
      };
    } catch (error) {
      return {
        workflowId: workflow.id,
        success: false,
        actionsExecuted,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private matchConditions(conditions: Record<string, unknown> | undefined, context: WorkflowContext): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    // Simple condition matching: check if context data contains matching values
    for (const [key, value] of Object.entries(conditions)) {
      const contextValue = context.data[key];
      if (contextValue === undefined) return false;

      if (typeof value === 'object' && value !== null) {
        const condition = value as Record<string, unknown>;
        if ('eq' in condition && contextValue !== condition.eq) return false;
        if ('neq' in condition && contextValue === condition.neq) return false;
        if ('gt' in condition && typeof contextValue === 'number' && contextValue <= (condition.gt as number)) return false;
        if ('lt' in condition && typeof contextValue === 'number' && contextValue >= (condition.lt as number)) return false;
        if ('in' in condition && Array.isArray(condition.in) && !condition.in.includes(contextValue)) return false;
      } else if (contextValue !== value) {
        return false;
      }
    }

    return true;
  }
}
