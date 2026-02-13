import type { Form } from '../entities/form.js';

export interface FormRepository {
  findById(orgId: string, id: string): Promise<Form | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Form[]; total: number }>;
  save(form: Form): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
