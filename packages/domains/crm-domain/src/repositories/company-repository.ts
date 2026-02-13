import type { Company } from '../entities/company.js';

export interface CompanyRepository {
  findById(orgId: string, id: string): Promise<Company | null>;
  findByDomain(orgId: string, domain: string): Promise<Company | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Company[]; total: number }>;
  save(company: Company): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
