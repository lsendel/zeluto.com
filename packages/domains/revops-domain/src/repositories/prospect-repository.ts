import type { Prospect } from '../entities/prospect.js';

export interface ProspectRepository {
  findByContact(orgId: string, contactId: string): Promise<Prospect | null>;
  findByOrganization(
    orgId: string,
    options?: { recommendation?: string; limit?: number; offset?: number },
  ): Promise<Prospect[]>;
  save(prospect: Prospect): Promise<void>;
}
