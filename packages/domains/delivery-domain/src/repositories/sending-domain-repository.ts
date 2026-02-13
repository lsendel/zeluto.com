import type { SendingDomain } from '../entities/sending-domain.js';

export interface SendingDomainRepository {
  findById(orgId: string, id: string): Promise<SendingDomain | null>;
  findByOrgAndDomain(orgId: string, domain: string): Promise<SendingDomain | null>;
  findByOrganization(orgId: string): Promise<SendingDomain[]>;
  save(sendingDomain: SendingDomain): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
