import {
  DeliverabilityDiagnostics,
  SeedTest,
  type SeedProvider,
} from '@mauntic/delivery-domain';
import { delivery_events } from '@mauntic/delivery-domain/drizzle';
import { and, eq, gte, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findSeedTestById,
  findSeedTestsByOrg,
  insertSeedTest,
  updateSeedTest,
} from '../infrastructure/repositories/seed-test-repository.js';

export const deliverabilityRoutes = new Hono<Env>();

// ── Seed Testing ────────────────────────────────────────

// POST /api/v1/delivery/seed-tests - Create and run a seed test
deliverabilityRoutes.post('/api/v1/delivery/seed-tests', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      subjectLine: string;
      htmlBody: string;
      fromAddress: string;
      sendingDomainId?: string;
      seedAddresses: Array<{ address: string; provider: SeedProvider }>;
    }>();

    if (!body.subjectLine || !body.htmlBody || !body.fromAddress) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'subjectLine, htmlBody, and fromAddress are required',
        },
        400,
      );
    }

    if (!body.seedAddresses?.length) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'At least one seed address is required',
        },
        400,
      );
    }

    const seedTest = SeedTest.create({
      organizationId: tenant.organizationId,
      sendingDomainId: body.sendingDomainId,
      subjectLine: body.subjectLine,
      htmlBody: body.htmlBody,
      fromAddress: body.fromAddress,
      seedAddresses: body.seedAddresses,
    });

    const props = seedTest.toProps();
    const row = await insertSeedTest(db, {
      id: props.id,
      organization_id: props.organizationId,
      sending_domain_id: props.sendingDomainId,
      subject_line: props.subjectLine,
      html_body: props.htmlBody,
      from_address: props.fromAddress,
      status: props.status,
      results: props.results,
    });

    // Enqueue seed test emails
    const queue = c.env.EVENTS;
    await queue.send({
      type: 'delivery.SeedTestStarted',
      data: {
        seedTestId: props.id,
        organizationId: tenant.organizationId,
      },
    });

    return c.json(row, 201);
  } catch (error) {
    console.error('Create seed test error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create seed test' },
      500,
    );
  }
});

// GET /api/v1/delivery/seed-tests - List seed tests
deliverabilityRoutes.get('/api/v1/delivery/seed-tests', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const limit = Math.min(50, parseInt(c.req.query('limit') ?? '20', 10));

  try {
    const tests = await findSeedTestsByOrg(db, tenant.organizationId, {
      limit,
    });
    return c.json({ data: tests });
  } catch (error) {
    console.error('List seed tests error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list seed tests' },
      500,
    );
  }
});

// GET /api/v1/delivery/seed-tests/:id - Get seed test results
deliverabilityRoutes.get('/api/v1/delivery/seed-tests/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const test = await findSeedTestById(db, tenant.organizationId, id);
    if (!test) {
      return c.json(
        { code: 'NOT_FOUND', message: 'Seed test not found' },
        404,
      );
    }
    return c.json(test);
  } catch (error) {
    console.error('Get seed test error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get seed test' },
      500,
    );
  }
});

// POST /api/v1/delivery/seed-tests/:id/results - Record seed test result (callback)
deliverabilityRoutes.post(
  '/api/v1/delivery/seed-tests/:id/results',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const id = c.req.param('id');

    try {
      const body = await c.req.json<{
        seedAddress: string;
        placement: 'inbox' | 'spam' | 'missing';
        headers?: Record<string, string>;
      }>();

      const row = await findSeedTestById(db, tenant.organizationId, id);
      if (!row) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Seed test not found' },
          404,
        );
      }

      const seedTest = SeedTest.reconstitute({
        id: row.id,
        organizationId: row.organization_id,
        sendingDomainId: row.sending_domain_id,
        subjectLine: row.subject_line,
        htmlBody: row.html_body,
        fromAddress: row.from_address,
        status: row.status as any,
        results: row.results as any[],
        inboxRate: row.inbox_rate ? Number(row.inbox_rate) : null,
        spamRate: row.spam_rate ? Number(row.spam_rate) : null,
        missingRate: row.missing_rate ? Number(row.missing_rate) : null,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      });

      seedTest.recordResult(body.seedAddress, body.placement, body.headers);
      const props = seedTest.toProps();

      await updateSeedTest(db, tenant.organizationId, id, {
        results: props.results,
        inbox_rate: props.inboxRate?.toString() ?? null,
        spam_rate: props.spamRate?.toString() ?? null,
        missing_rate: props.missingRate?.toString() ?? null,
      });

      return c.json({ success: true });
    } catch (error) {
      console.error('Record seed result error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to record result' },
        500,
      );
    }
  },
);

// POST /api/v1/delivery/seed-tests/:id/complete - Mark seed test complete
deliverabilityRoutes.post(
  '/api/v1/delivery/seed-tests/:id/complete',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const id = c.req.param('id');

    try {
      const row = await findSeedTestById(db, tenant.organizationId, id);
      if (!row) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Seed test not found' },
          404,
        );
      }

      const seedTest = SeedTest.reconstitute({
        id: row.id,
        organizationId: row.organization_id,
        sendingDomainId: row.sending_domain_id,
        subjectLine: row.subject_line,
        htmlBody: row.html_body,
        fromAddress: row.from_address,
        status: row.status as any,
        results: row.results as any[],
        inboxRate: row.inbox_rate ? Number(row.inbox_rate) : null,
        spamRate: row.spam_rate ? Number(row.spam_rate) : null,
        missingRate: row.missing_rate ? Number(row.missing_rate) : null,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
      });

      seedTest.markCompleted();
      const props = seedTest.toProps();

      await updateSeedTest(db, tenant.organizationId, id, {
        status: props.status,
        results: props.results,
        inbox_rate: props.inboxRate?.toString() ?? null,
        spam_rate: props.spamRate?.toString() ?? null,
        missing_rate: props.missingRate?.toString() ?? null,
        completed_at: props.completedAt,
      });

      return c.json({
        inboxRate: props.inboxRate,
        spamRate: props.spamRate,
        missingRate: props.missingRate,
      });
    } catch (error) {
      console.error('Complete seed test error:', error);
      return c.json(
        { code: 'INTERNAL_ERROR', message: 'Failed to complete seed test' },
        500,
      );
    }
  },
);

// ── Deliverability Diagnostics ──────────────────────────

// GET /api/v1/delivery/diagnostics - Deliverability health report
deliverabilityRoutes.get('/api/v1/delivery/diagnostics', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const days = parseInt(c.req.query('days') ?? '30', 10);

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Aggregate delivery events for the period
    const [summary] = await db
      .select({
        sent: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'sent')::int`,
        delivered: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'delivered')::int`,
        bounced: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'bounced')::int`,
        complained: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'complained')::int`,
        opened: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'opened')::int`,
        clicked: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'clicked')::int`,
        unsubscribed: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'unsubscribed')::int`,
      })
      .from(delivery_events)
      .where(
        and(
          eq(delivery_events.organization_id, tenant.organizationId),
          gte(delivery_events.created_at, since),
        ),
      );

    const diagnostics = new DeliverabilityDiagnostics();
    const report = diagnostics.analyze({
      sent: summary?.sent ?? 0,
      delivered: summary?.delivered ?? 0,
      bounced: summary?.bounced ?? 0,
      complained: summary?.complained ?? 0,
      opened: summary?.opened ?? 0,
      clicked: summary?.clicked ?? 0,
      unsubscribed: summary?.unsubscribed ?? 0,
    });

    return c.json({ period: { days, since: since.toISOString() }, ...report });
  } catch (error) {
    console.error('Diagnostics error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to generate diagnostics' },
      500,
    );
  }
});

// GET /api/v1/delivery/diagnostics/trend - Compare current vs previous period
deliverabilityRoutes.get('/api/v1/delivery/diagnostics/trend', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const days = parseInt(c.req.query('days') ?? '30', 10);

  try {
    const now = Date.now();
    const currentStart = new Date(now - days * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now - 2 * days * 24 * 60 * 60 * 1000);

    const aggregateEvents = async (since: Date, until: Date) => {
      const [result] = await db
        .select({
          sent: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'sent')::int`,
          delivered: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'delivered')::int`,
          bounced: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'bounced')::int`,
          complained: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'complained')::int`,
          opened: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'opened')::int`,
          clicked: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'clicked')::int`,
          unsubscribed: sql<number>`count(*) filter (where ${delivery_events.event_type} = 'unsubscribed')::int`,
        })
        .from(delivery_events)
        .where(
          and(
            eq(delivery_events.organization_id, tenant.organizationId),
            gte(delivery_events.created_at, since),
            sql`${delivery_events.created_at} < ${until}`,
          ),
        );
      return {
        sent: result?.sent ?? 0,
        delivered: result?.delivered ?? 0,
        bounced: result?.bounced ?? 0,
        complained: result?.complained ?? 0,
        opened: result?.opened ?? 0,
        clicked: result?.clicked ?? 0,
        unsubscribed: result?.unsubscribed ?? 0,
      };
    };

    const [current, previous] = await Promise.all([
      aggregateEvents(currentStart, new Date(now)),
      aggregateEvents(previousStart, currentStart),
    ]);

    const diagnostics = new DeliverabilityDiagnostics();
    const comparison = diagnostics.comparePeriods(current, previous);

    return c.json({
      period: { days },
      ...comparison,
    });
  } catch (error) {
    console.error('Diagnostics trend error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to generate trend' },
      500,
    );
  }
});
