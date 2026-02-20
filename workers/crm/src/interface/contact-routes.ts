import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import { ContactService } from '../application/contact-service.js';
import { QueueDomainEventPublisher } from '../application/domain-event-publisher.js';
import { DrizzleContactRepository } from '../infrastructure/repositories/drizzle-contact-repository.js';

export const contactRoutes = new Hono();

function getTenant(c: any) {
  return c.get('tenant') as { organizationId: string; userId: string };
}

function getDb(c: any): NeonHttpDatabase {
  return c.get('db') as NeonHttpDatabase;
}

function getContactService(c: any): ContactService {
  const db = getDb(c);
  const repo = new DrizzleContactRepository(db);
  const publisher = new QueueDomainEventPublisher(c.env.EVENTS);
  return new ContactService(repo, publisher);
}

// GET /api/v1/crm/contacts - List contacts
contactRoutes.get('/api/v1/crm/contacts', async (c) => {
  const tenant = getTenant(c);
  const db = getDb(c);
  const { page = '1', limit = '20', search } = c.req.query();

  const repo = new DrizzleContactRepository(db);
  const result = await repo.findByOrganization(tenant.organizationId, {
    page: Number(page),
    limit: Number(limit),
    search,
  });

  return c.json({
    data: result.data.map((contact) => contact.toProps()),
    total: result.total,
    page: Number(page),
    limit: Number(limit),
  });
});

// POST /api/v1/crm/contacts - Create contact
contactRoutes.post('/api/v1/crm/contacts', async (c) => {
  const tenant = getTenant(c);
  const body = await c.req.json();

  const service = getContactService(c);

  const result = await service.create({
    organizationId: tenant.organizationId,
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    customFields: body.customFields,
  });

  if (result.isFailure) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: result.getError() },
      400,
    );
  }

  return c.json(result.getValue().toProps(), 201);
});

// GET /api/v1/crm/contacts/:id - Get contact
contactRoutes.get('/api/v1/crm/contacts/:id', async (c) => {
  const tenant = getTenant(c);
  const db = getDb(c);
  const id = c.req.param('id');

  const repo = new DrizzleContactRepository(db);
  const contact = await repo.findById(tenant.organizationId, id);

  if (!contact) {
    return c.json({ code: 'NOT_FOUND', message: 'Contact not found' }, 404);
  }

  return c.json(contact.toProps());
});

// PATCH /api/v1/crm/contacts/:id - Update contact
contactRoutes.patch('/api/v1/crm/contacts/:id', async (c) => {
  const tenant = getTenant(c);
  const id = c.req.param('id');
  const body = await c.req.json();

  const service = getContactService(c);

  const result = await service.update(tenant.organizationId, id, {
    email: body.email,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone,
    customFields: body.customFields,
  });

  if (result.isFailure) {
    const error = result.getError();
    if (error === 'Contact not found') {
      return c.json({ code: 'NOT_FOUND', message: error }, 404);
    }
    return c.json({ code: 'VALIDATION_ERROR', message: error }, 400);
  }

  return c.json(result.getValue().toProps());
});

// DELETE /api/v1/crm/contacts/:id - Delete contact
contactRoutes.delete('/api/v1/crm/contacts/:id', async (c) => {
  const tenant = getTenant(c);
  const id = c.req.param('id');

  const service = getContactService(c);

  const result = await service.delete(tenant.organizationId, id, tenant.userId);
  if (result.isFailure) {
    return c.json({ code: 'NOT_FOUND', message: result.getError() }, 404);
  }

  return c.json({ success: true });
});
