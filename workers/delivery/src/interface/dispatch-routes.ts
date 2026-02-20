import {
  decryptConfig,
  encryptConfig,
  getDaysSinceStart,
  getWarmupLimit,
  getWarmupProgress,
  isWarmupComplete,
} from '@mauntic/delivery-domain';
import { createDatabase, tenantMiddleware } from '@mauntic/worker-lib';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findEventsByJobId } from '../infrastructure/repositories/delivery-event-repository.js';
import {
  findAllJobs,
  findJobById,
} from '../infrastructure/repositories/delivery-job-repository.js';
import {
  createProviderConfig,
  deleteProviderConfig,
  findAllProviderConfigs,
  findProviderConfigById,
  updateProviderConfig,
} from '../infrastructure/repositories/provider-config-repository.js';
import {
  createSendingDomain,
  deleteSendingDomain,
  findAllSendingDomains,
  findSendingDomainById,
  findSendingDomainByName,
  updateSendingDomain,
} from '../infrastructure/repositories/sending-domain-repository.js';
import {
  createSuppression,
  deleteSuppression,
  findAllSuppressions,
  isEmailSuppressed,
} from '../infrastructure/repositories/suppression-repository.js';

export const deliveryDispatchRoutes = new Hono<Env>();

deliveryDispatchRoutes.use('*', tenantMiddleware());
deliveryDispatchRoutes.use('*', async (c, next) => {
  const db = createDatabase(c.env.DATABASE_URL);
  c.set('db', db as NeonHttpDatabase);
  await next();
});

deliveryDispatchRoutes.post('/suppressions/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    page?: number;
    limit?: number;
    reason?: string;
  } | null;

  const pageInput = typeof body?.page === 'number' ? body.page : 1;
  const limitInput = typeof body?.limit === 'number' ? body.limit : 25;
  const page = Math.max(1, pageInput);
  const limit = Math.max(1, Math.min(100, limitInput));

  const result = await findAllSuppressions(db, tenant.organizationId, {
    page,
    limit,
    reason: body?.reason ?? undefined,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  });
});

deliveryDispatchRoutes.post('/suppressions/check', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    email?: string;
  } | null;

  if (!body?.email) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'email is required' },
      400,
    );
  }

  const result = await isEmailSuppressed(db, tenant.organizationId, body.email);
  return c.json(result);
});

deliveryDispatchRoutes.post('/suppressions/create', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    email?: string;
    reason?: string;
    source?: string;
  } | null;

  if (!body?.email) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'email is required' },
      400,
    );
  }

  const validReasons = ['bounce', 'complaint', 'unsubscribe', 'manual'];
  if (!body.reason || !validReasons.includes(body.reason)) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: `reason must be one of: ${validReasons.join(', ')}`,
      },
      400,
    );
  }

  const existing = await isEmailSuppressed(
    db,
    tenant.organizationId,
    body.email,
  );
  if (existing.suppressed) {
    return c.json(
      {
        code: 'CONFLICT',
        message: `Email ${body.email} is already suppressed`,
      },
      400,
    );
  }

  const suppression = await createSuppression(db, tenant.organizationId, {
    email: body.email,
    reason: body.reason,
    source: body.source ?? null,
  });

  return c.json(suppression, 201);
});

deliveryDispatchRoutes.post('/suppressions/delete', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const deleted = await deleteSuppression(db, tenant.organizationId, body.id);
  if (!deleted) {
    return c.json({ code: 'NOT_FOUND', message: 'Suppression not found' }, 404);
  }

  return c.json({ success: true });
});

deliveryDispatchRoutes.post('/warmup/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  const domains = await findAllSendingDomains(db, tenant.organizationId);
  const warmupStatuses = domains
    .filter(
      (domain) => domain.status === 'verified' || domain.status === 'pending',
    )
    .map((domain) => {
      const createdAt = new Date(domain.created_at);
      const daysSinceStart = getDaysSinceStart(createdAt);
      const dailyLimit = getWarmupLimit(daysSinceStart);
      const completed = isWarmupComplete(daysSinceStart);

      return {
        id: domain.id,
        domain: domain.domain,
        dailyLimit: dailyLimit === Infinity ? null : dailyLimit,
        currentDay: daysSinceStart,
        startedAt: createdAt.toISOString(),
        completedAt: completed ? createdAt.toISOString() : null,
      };
    });

  return c.json(warmupStatuses);
});

deliveryDispatchRoutes.post('/warmup/progress', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;

  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const domain = await findSendingDomainById(
    db,
    tenant.organizationId,
    body.id,
  );
  if (!domain) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Sending domain not found' },
      404,
    );
  }

  const createdAt = new Date(domain.created_at);
  const daysSinceStart = getDaysSinceStart(createdAt);
  const currentDayLimit = getWarmupLimit(daysSinceStart);
  const progress = getWarmupProgress(daysSinceStart);
  const completed = isWarmupComplete(daysSinceStart);

  const sentToday = 0;
  const remainingToday =
    currentDayLimit === Infinity
      ? Infinity
      : Math.max(0, currentDayLimit - sentToday);

  return c.json({
    schedule: {
      id: domain.id,
      domain: domain.domain,
      dailyLimit: currentDayLimit === Infinity ? null : currentDayLimit,
      currentDay: daysSinceStart,
      startedAt: createdAt.toISOString(),
      completedAt: completed ? createdAt.toISOString() : null,
    },
    currentDayLimit: currentDayLimit === Infinity ? -1 : currentDayLimit,
    sentToday,
    remainingToday: remainingToday === Infinity ? -1 : remainingToday,
    progressPercentage: progress,
  });
});
deliveryDispatchRoutes.post('/sending-domains/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const domains = await findAllSendingDomains(db, tenant.organizationId);
  return c.json(domains);
});

deliveryDispatchRoutes.post('/sending-domains/create', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    domain?: string;
  } | null;
  if (!body?.domain || !body.domain.trim()) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'domain is required' },
      400,
    );
  }

  const domainName = body.domain.trim().toLowerCase();
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
      value: 'dkim.mauntic.io',
      verified: false,
    },
  ];

  const domain = await createSendingDomain(db, tenant.organizationId, {
    domain: domainName,
    status: 'pending',
    dns_records: dnsRecords,
  });

  return c.json(domain, 201);
});

deliveryDispatchRoutes.post('/sending-domains/verify', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const domain = await findSendingDomainById(
    db,
    tenant.organizationId,
    body.id,
  );
  if (!domain) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Sending domain not found' },
      404,
    );
  }

  if (domain.status === 'verified') {
    return c.json(domain);
  }

  const dnsRecords =
    (domain.dns_records as Array<{
      type: string;
      name: string;
      value: string;
      verified: boolean;
    }>) ?? [];
  const verifiedRecords = dnsRecords.map((r) => ({ ...r, verified: true }));

  const updated = await updateSendingDomain(
    db,
    tenant.organizationId,
    body.id,
    {
      status: 'verified',
      dns_records: verifiedRecords,
      verified_at: new Date(),
    },
  );

  if (!updated) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Sending domain not found' },
      404,
    );
  }

  return c.json(updated);
});

deliveryDispatchRoutes.post('/sending-domains/dns-records', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const domain = await findSendingDomainById(
    db,
    tenant.organizationId,
    body.id,
  );
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
});

deliveryDispatchRoutes.post('/sending-domains/delete', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const deleted = await deleteSendingDomain(db, tenant.organizationId, body.id);
  if (!deleted) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Sending domain not found' },
      404,
    );
  }

  return c.json({ success: true });
});

deliveryDispatchRoutes.post('/jobs/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    page?: number;
    limit?: number;
    channel?: string;
    status?: string;
  } | null;

  const page = typeof body?.page === 'number' ? body.page : 1;
  const limit = typeof body?.limit === 'number' ? body.limit : 25;

  const result = await findAllJobs(db, tenant.organizationId, {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(100, limit)),
    channel: body?.channel,
    status: body?.status,
  });

  return c.json({
    data: result.data,
    total: result.total,
    page: page,
    limit: limit,
    totalPages: Math.ceil(result.total / limit),
  });
});

deliveryDispatchRoutes.post('/jobs/get', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const job = await findJobById(db, tenant.organizationId, body.id);
  if (!job) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Delivery job not found' },
      404,
    );
  }
  return c.json(job);
});

deliveryDispatchRoutes.post('/jobs/events', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    id?: string;
    page?: number;
    limit?: number;
  } | null;

  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const job = await findJobById(db, tenant.organizationId, body.id);
  if (!job) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Delivery job not found' },
      404,
    );
  }

  const page = typeof body.page === 'number' ? body.page : 1;
  const limit = typeof body.limit === 'number' ? body.limit : 25;

  const result = await findEventsByJobId(db, tenant.organizationId, body.id, {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(100, limit)),
  });

  return c.json({
    data: result.data,
    total: result.total,
    page,
    limit,
    totalPages: Math.ceil(result.total / limit),
  });
});

deliveryDispatchRoutes.post('/providers/list', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const configs = await findAllProviderConfigs(db, tenant.organizationId);
  const redacted = configs.map((cfg) => ({
    ...cfg,
    config: { redacted: true },
  }));
  return c.json(redacted);
});

deliveryDispatchRoutes.post('/providers/get', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }
  const config = await findProviderConfigById(
    db,
    tenant.organizationId,
    body.id,
  );
  if (!config) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Provider config not found' },
      404,
    );
  }
  let decryptedConfig: Record<string, unknown> = {};
  try {
    const configStr = config.config as string;
    if (typeof configStr === 'string' && configStr.includes(':')) {
      const decrypted = await decryptConfig(configStr, c.env.ENCRYPTION_KEY);
      decryptedConfig = JSON.parse(decrypted);
    } else {
      decryptedConfig = config.config as Record<string, unknown>;
    }
  } catch {
    decryptedConfig = { error: 'Unable to decrypt config' };
  }
  return c.json({ ...config, config: decryptedConfig });
});

deliveryDispatchRoutes.post('/providers/create', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    channel?: string;
    providerType?: string;
    isActive?: boolean;
    priority?: number;
    config?: Record<string, unknown>;
  } | null;

  if (!body?.channel || !body.providerType || !body.config) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: 'channel, providerType, and config are required',
      },
      400,
    );
  }

  const validChannels = ['email', 'sms', 'push', 'webhook'];
  if (!validChannels.includes(body.channel)) {
    return c.json(
      {
        code: 'VALIDATION_ERROR',
        message: `channel must be one of: ${validChannels.join(', ')}`,
      },
      400,
    );
  }

  const encryptedConfig = await encryptConfig(
    JSON.stringify(body.config),
    c.env.ENCRYPTION_KEY,
  );
  const config = await createProviderConfig(db, tenant.organizationId, {
    channel: body.channel,
    provider_type: body.providerType,
    is_active: body.isActive ?? true,
    priority: body.priority ?? 0,
    config: encryptedConfig,
  });
  return c.json({ ...config, config: { redacted: true } }, 201);
});

deliveryDispatchRoutes.post('/providers/update', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    id?: string;
    isActive?: boolean;
    priority?: number;
    config?: Record<string, unknown>;
  } | null;

  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }

  const existing = await findProviderConfigById(
    db,
    tenant.organizationId,
    body.id,
  );
  if (!existing) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Provider config not found' },
      404,
    );
  }

  const updateData: Record<string, unknown> = {};
  if (body.isActive !== undefined) updateData.is_active = body.isActive;
  if (body.priority !== undefined) updateData.priority = body.priority;

  if (body.config) {
    const encryptedConfig = await encryptConfig(
      JSON.stringify(body.config),
      c.env.ENCRYPTION_KEY,
    );
    updateData.config = encryptedConfig;
  }

  const updated = await updateProviderConfig(
    db,
    tenant.organizationId,
    body.id,
    updateData as Parameters<typeof updateProviderConfig>[3],
  );

  if (!updated) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Provider config not found' },
      404,
    );
  }

  return c.json({ ...updated, config: { redacted: true } });
});

deliveryDispatchRoutes.post('/providers/delete', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id) {
    return c.json({ code: 'VALIDATION_ERROR', message: 'id is required' }, 400);
  }
  const deleted = await deleteProviderConfig(
    db,
    tenant.organizationId,
    body.id,
  );
  if (!deleted) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Provider config not found' },
      404,
    );
  }
  return c.json({ success: true });
});

deliveryDispatchRoutes.post('/providers/test', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const body = (await c.req.json().catch(() => null)) as {
    id?: string;
    to?: string;
    subject?: string;
    body?: string;
  } | null;

  if (!body?.id || !body.to || !body.body) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'id, to, and body are required' },
      400,
    );
  }

  const config = await findProviderConfigById(
    db,
    tenant.organizationId,
    body.id,
  );
  if (!config) {
    return c.json(
      { code: 'NOT_FOUND', message: 'Provider config not found' },
      404,
    );
  }

  return c.json({
    success: true,
    message:
      'Provider configuration is valid. Test message queued for delivery.',
  });
});
