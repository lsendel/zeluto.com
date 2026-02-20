import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  createSendingDomain,
  deleteSendingDomain,
  findAllSendingDomains,
  findSendingDomainById,
  findSendingDomainByName,
  updateSendingDomain,
} from '../infrastructure/repositories/sending-domain-repository.js';

export const domainRoutes = new Hono<Env>();

// GET /api/v1/delivery/sending-domains - List sending domains
domainRoutes.get('/api/v1/delivery/sending-domains', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const domains = await findAllSendingDomains(db, tenant.organizationId);
    return c.json(domains);
  } catch (error) {
    console.error('List sending domains error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list sending domains' },
      500,
    );
  }
});

// POST /api/v1/delivery/sending-domains - Add sending domain
domainRoutes.post('/api/v1/delivery/sending-domains', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{ domain: string }>();

    if (!body.domain || body.domain.trim().length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'domain is required' },
        400,
      );
    }

    const domainName = body.domain.trim().toLowerCase();

    // Check for duplicate
    const existing = await findSendingDomainByName(
      db,
      tenant.organizationId,
      domainName,
    );
    if (existing) {
      return c.json(
        { code: 'CONFLICT', message: `Domain ${domainName} already exists` },
        400,
      );
    }

    // Generate expected DNS records for verification
    const verificationToken = crypto.randomUUID().replace(/-/g, '');
    const dnsRecords = [
      {
        type: 'TXT',
        name: `_mauntic.${domainName}`,
        value: `mauntic-verify=${verificationToken}`,
        verified: false,
      },
      {
        type: 'TXT',
        name: domainName,
        value: `v=spf1 include:_spf.mauntic.io ~all`,
        verified: false,
      },
      {
        type: 'CNAME',
        name: `mauntic._domainkey.${domainName}`,
        value: `dkim.mauntic.io`,
        verified: false,
      },
    ];

    const domain = await createSendingDomain(db, tenant.organizationId, {
      domain: domainName,
      status: 'pending',
      dns_records: dnsRecords,
    });

    return c.json(domain, 201);
  } catch (error) {
    console.error('Add sending domain error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to add sending domain' },
      500,
    );
  }
});

// POST /api/v1/delivery/sending-domains/:id/verify - Verify sending domain
domainRoutes.post('/api/v1/delivery/sending-domains/:id/verify', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const domain = await findSendingDomainById(db, tenant.organizationId, id);
    if (!domain) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Sending domain not found' },
        404,
      );
    }

    if (domain.status === 'verified') {
      return c.json(domain);
    }

    // In a real implementation, we would verify DNS records here.
    // For now, mark all records as verified and update the domain status.
    const dnsRecords =
      (domain.dns_records as Array<{
        type: string;
        name: string;
        value: string;
        verified: boolean;
      }>) ?? [];

    const verifiedRecords = dnsRecords.map((r) => ({ ...r, verified: true }));

    const updated = await updateSendingDomain(db, tenant.organizationId, id, {
      status: 'verified',
      dns_records: verifiedRecords,
      verified_at: new Date(),
    });

    if (!updated) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Sending domain not found' },
        404,
      );
    }

    return c.json(updated);
  } catch (error) {
    console.error('Verify sending domain error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to verify sending domain' },
      500,
    );
  }
});

// GET /api/v1/delivery/sending-domains/:id/dns-records - Get DNS records
domainRoutes.get(
  '/api/v1/delivery/sending-domains/:id/dns-records',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const id = c.req.param('id');

    try {
      const domain = await findSendingDomainById(db, tenant.organizationId, id);
      if (!domain) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Sending domain not found' },
          404,
        );
      }

      return c.json({
        records:
          (domain.dns_records as Array<{
            type: string;
            name: string;
            value: string;
            verified: boolean;
          }>) ?? [],
      });
    } catch (error) {
      console.error('Get DNS records error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to get DNS records' },
        500,
      );
    }
  },
);

// DELETE /api/v1/delivery/sending-domains/:id - Delete sending domain
domainRoutes.delete('/api/v1/delivery/sending-domains/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteSendingDomain(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Sending domain not found' },
        404,
      );
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete sending domain error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete sending domain' },
      500,
    );
  }
});
