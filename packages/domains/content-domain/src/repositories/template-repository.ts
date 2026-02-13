import type { Template } from '../entities/template.js';

export interface TemplateRepository {
  findById(orgId: string, id: string): Promise<Template | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Template[]; total: number }>;
  save(template: Template): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
