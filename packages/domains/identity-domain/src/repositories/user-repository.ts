import type { OrganizationId, UserId } from '@mauntic/domain-kernel';
import type { User } from '../entities/user.js';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByOrganization(
    organizationId: OrganizationId,
    pagination: { page: number; limit: number },
  ): Promise<{ users: User[]; total: number }>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
}
