import type { Contact } from '../entities/contact.js';

export interface ContactRepository {
  findById(orgId: string, id: string): Promise<Contact | null>;
  findByEmail(orgId: string, email: string): Promise<Contact | null>;
  findByOrganization(
    orgId: string,
    pagination: { page: number; limit: number; search?: string },
  ): Promise<{ data: Contact[]; total: number }>;
  findBySegment(
    orgId: string,
    segmentId: string,
    pagination: { offset: number; limit: number },
  ): Promise<{ data: Contact[]; total: number; nextOffset: number | null }>;
  save(contact: Contact): Promise<void>;
  saveMany(contacts: Contact[]): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
  countByOrganization(orgId: string): Promise<number>;
}
