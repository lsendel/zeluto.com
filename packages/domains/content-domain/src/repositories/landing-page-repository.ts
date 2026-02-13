import type { LandingPage } from '../entities/landing-page.js';

export interface LandingPageRepository {
  findById(orgId: string, id: string): Promise<LandingPage | null>;
  findBySlug(orgId: string, slug: string): Promise<LandingPage | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: LandingPage[]; total: number }>;
  save(page: LandingPage): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
