import type { WorkflowDefinition } from '../services/workflow-engine.js';

export interface WorkflowExecution {
  id: string;
  organizationId: string;
  workflowId: string;
  dealId?: string;
  contactId?: string;
  triggeredAt: Date;
  status: string;
  results?: Record<string, unknown>;
  error?: string;
}

export interface WorkflowRepository {
  findById(orgId: string, id: string): Promise<WorkflowDefinition | null>;
  findByOrganization(orgId: string): Promise<WorkflowDefinition[]>;
  findByTrigger(orgId: string, trigger: string): Promise<WorkflowDefinition[]>;
  save(orgId: string, workflow: WorkflowDefinition): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
  saveExecution(orgId: string, execution: WorkflowExecution): Promise<void>;
  findExecutionsByWorkflow(
    orgId: string,
    workflowId: string,
    limit?: number,
  ): Promise<WorkflowExecution[]>;
}
