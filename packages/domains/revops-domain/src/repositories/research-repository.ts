import type { ResearchInsight } from '../services/research-agent.js';

export interface ResearchJob {
  id: string;
  organizationId: string;
  contactId: string;
  type: string;
  status: string;
  results?: Record<string, unknown>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface ResearchRepository {
  findJobById(orgId: string, id: string): Promise<ResearchJob | null>;
  findJobsByContact(orgId: string, contactId: string): Promise<ResearchJob[]>;
  saveJob(orgId: string, job: ResearchJob): Promise<void>;
  findInsightsByContact(
    orgId: string,
    contactId: string,
    options?: { insightType?: string; limit?: number },
  ): Promise<ResearchInsight[]>;
  saveInsight(
    orgId: string,
    contactId: string,
    insight: ResearchInsight,
  ): Promise<void>;
}
