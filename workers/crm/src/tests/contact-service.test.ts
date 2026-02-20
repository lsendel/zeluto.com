import { Contact, type ContactRepository } from '@mauntic/crm-domain'; // Using contract interface
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactService } from '../application/contact-service.js';
import type { DomainEventPublisher } from '../application/domain-event-publisher.js';

// Mock Repository
const mockRepo: ContactRepository = {
  findById: vi.fn(),
  findByEmail: vi.fn(),
  findByOrganization: vi.fn(),
  findBySegment: vi
    .fn()
    .mockResolvedValue({ data: [], total: 0, nextOffset: null }),
  save: vi.fn(),
  saveMany: vi.fn(),
  delete: vi.fn(),
  countByOrganization: vi.fn(),
};

// Mock Events
const mockEvents: DomainEventPublisher = {
  publish: vi.fn(),
};

describe('ContactService', () => {
  let service: ContactService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ContactService(mockRepo, mockEvents);
  });

  describe('create', () => {
    it('should create a contact successfully', async () => {
      const input = {
        organizationId: crypto.randomUUID(),
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      // Mock findByEmail to return null (no duplicate)
      vi.mocked(mockRepo.findByEmail).mockResolvedValue(null);

      const result = await service.create(input);

      expect(result.isSuccess).toBe(true);
      const contact = result.getValue();
      expect(contact.email).toBe(input.email);
      expect(contact.organizationId).toBe(input.organizationId);

      expect(mockRepo.save).toHaveBeenCalledWith(contact);
      expect(mockEvents.publish).toHaveBeenCalled(); // Should publish events
    });

    it('should fail if email already exists', async () => {
      const input = {
        organizationId: crypto.randomUUID(),
        email: 'duplicate@example.com',
      };

      // Mock findByEmail to return existing contact
      vi.mocked(mockRepo.findByEmail).mockResolvedValue({
        id: 'existing',
      } as any);

      const result = await service.create(input);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBe('Contact with this email already exists');
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const input = {
        organizationId: crypto.randomUUID(),
        email: 'invalid-email', // Invalid format
      };

      // Mock findByEmail to return null so it doesn't fail the existence check
      vi.mocked(mockRepo.findByEmail).mockResolvedValue(null);

      // findByEmail won't be called if validation fails in Contact.create
      // Actually validation happens inside Contact.create so we expect that to throw
      // Service catches error and returns Result.fail

      const result = await service.create(input);

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toContain('Invalid email format');
    });
  });

  describe('update', () => {
    it('should update a contact successfully', async () => {
      const orgId = crypto.randomUUID();
      const contactId = crypto.randomUUID();

      // Mock existing contact
      const existingContact = Contact.create({
        organizationId: orgId,
        email: 'old@example.com',
      });
      // Hack: set ID to match our test ID if needed, but create generates random one.
      // For unit test, we can just rely on repository returning *a* contact.

      vi.mocked(mockRepo.findById).mockResolvedValue(existingContact);

      const result = await service.update(orgId, contactId, {
        firstName: 'Jane',
      });

      expect(result.isSuccess).toBe(true);
      const updated = result.getValue();
      expect(updated.firstName).toBe('Jane');
      expect(updated.email).toBe('old@example.com'); // Unchanged

      expect(mockRepo.save).toHaveBeenCalled();
      expect(mockEvents.publish).toHaveBeenCalled();
    });

    it('should fail if contact not found', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);

      const result = await service.update('org-id', 'missing-id', {
        firstName: 'Jane',
      });

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBe('Contact not found');
    });
  });

  describe('delete', () => {
    it('should delete a contact', async () => {
      const orgId = crypto.randomUUID();
      const id = crypto.randomUUID();
      const existingContact = Contact.create({
        organizationId: orgId,
        email: 'del@example.com',
      });

      vi.mocked(mockRepo.findById).mockResolvedValue(existingContact);

      const result = await service.delete(orgId, id, 'user-123');

      expect(result.isSuccess).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith(orgId, id);
    });

    it('should fail if contact not found', async () => {
      vi.mocked(mockRepo.findById).mockResolvedValue(null);

      const result = await service.delete('org-1', 'missing', 'user-123');

      expect(result.isFailure).toBe(true);
      expect(result.getError()).toBe('Contact not found');
    });
  });
});
