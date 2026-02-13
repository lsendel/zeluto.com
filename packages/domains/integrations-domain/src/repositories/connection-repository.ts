import type { Connection } from '../entities/connection.js';

export interface ConnectionRepository {
  save(connection: Connection): Promise<void>;
  findById(orgId: string, id: string): Promise<Connection | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ data: Connection[]; total: number }>;
  findByProvider(orgId: string, provider: string): Promise<Connection[]>;
  update(connection: Connection): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
