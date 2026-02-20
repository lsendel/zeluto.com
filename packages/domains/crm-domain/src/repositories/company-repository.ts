import type { CompanyId, OrganizationId } from '@mauntic/domain-kernel';
import type { Company } from '../entities/company.js';

export interface CompanyRepository {
  findById(orgId: OrganizationId, id: CompanyId): Promise<Company | null>;
  findByDomain(orgId: OrganizationId, domain: string): Promise<Company | null>;
  findByOrganization(
    orgId: OrganizationId,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Company[]; total: number }>;
  save(company: Company): Promise<void>;
  delete(orgId: OrganizationId, id: CompanyId): Promise<void>;
}
