import { Contact, type ContactRepository } from '@mauntic/crm-domain';
import { Result, type DomainEvent } from '@mauntic/domain-kernel';
import { contactDeleted } from '../events/contact-events.js';
import type { DomainEventPublisher } from './domain-event-publisher.js';

export class ContactService {
    constructor(
        private readonly contactRepo: ContactRepository,
        private readonly events: DomainEventPublisher,
    ) { }

    async create(input: {
        organizationId: string;
        email?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        phone?: string | null;
        customFields?: Record<string, unknown>;
    }): Promise<Result<Contact>> {
        try {
            // Validate uniqueness if email present
            if (input.email) {
                const existing = await this.contactRepo.findByEmail(input.organizationId, input.email);
                if (existing) {
                    return Result.fail('Contact with this email already exists');
                }
            }

            const contact = Contact.create(input);
            await this.contactRepo.save(contact);
            await this.publishDomainEvents(contact);

            return Result.ok(contact);
        } catch (err: any) {
            return Result.fail(err.message || 'Failed to create contact');
        }
    }

    async update(
        orgId: string,
        id: string,
        input: {
            email?: string | null;
            firstName?: string | null;
            lastName?: string | null;
            phone?: string | null;
            customFields?: Record<string, unknown>;
        }
    ): Promise<Result<Contact>> {
        const contact = await this.contactRepo.findById(orgId, id);
        if (!contact) {
            return Result.fail('Contact not found');
        }

        try {
            contact.update(input);
            await this.contactRepo.save(contact);
            await this.publishDomainEvents(contact);

            return Result.ok(contact);
        } catch (err: any) {
            return Result.fail(err.message || 'Failed to update contact');
        }
    }

    async delete(orgId: string, id: string, actorId: string): Promise<Result<void>> {
        const contact = await this.contactRepo.findById(orgId, id);
        if (!contact) {
            return Result.fail('Contact not found');
        }

        await this.contactRepo.delete(orgId, id);
        await this.events.publish([
            contactDeleted({
                contactId: contact.toProps().id,
                organizationId: orgId,
                deletedBy: actorId,
            }),
        ]);

        return Result.ok();
    }

    private async publishDomainEvents(contact: Contact): Promise<void> {
        const events: DomainEvent[] = contact.pullDomainEvents();
        if (events.length === 0) return;
        await this.events.publish(events);
    }
}
