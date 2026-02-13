import type { StepExecution } from '../entities/step-execution.js';

export interface StepExecutionRepository {
  findById(orgId: string, id: string): Promise<StepExecution | null>;
  findByExecution(orgId: string, executionId: string): Promise<StepExecution[]>;
  save(stepExecution: StepExecution): Promise<void>;
  updateStatus(stepExecution: StepExecution): Promise<void>;
}
