import type { Report } from '../entities/report.js';

export interface ReportRepository {
  save(report: Report): Promise<void>;
  findById(orgId: string, id: string): Promise<Report | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Report[]; total: number }>;
  update(report: Report): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
