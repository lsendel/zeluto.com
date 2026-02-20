import type { OrganizationId } from '@mauntic/domain-kernel';
import type { StepExecution } from '../entities/step-execution.js';

export interface StepExecutionRepository {
  findById(orgId: OrganizationId, id: string): Promise<StepExecution | null>;
  findByExecution(orgId: OrganizationId, executionId: string): Promise<StepExecution[]>;
  save(stepExecution: StepExecution): Promise<void>;
  updateStatus(stepExecution: StepExecution): Promise<void>;
}
