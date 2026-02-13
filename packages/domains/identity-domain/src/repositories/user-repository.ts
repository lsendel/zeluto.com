import type { User } from '../entities/user.js';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByOrganization(
    organizationId: string,
    pagination: { page: number; limit: number },
  ): Promise<{ users: User[]; total: number }>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
}
