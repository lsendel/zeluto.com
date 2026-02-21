import { Hono } from 'hono';
import type { Env } from '../index.js';

export function createOpsRoutes() {
  const app = new Hono<Env>();

  /**
   * GET /release-readiness
   *
   * Fan out /health checks to all bound domain workers.
   * Returns an aggregate readiness verdict.
   */
  app.get('/release-readiness', async (c) => {
    const services = getServiceBindings(c.env);

    const checks = await Promise.all(
      services.map(async ({ name, binding }) => {
        const result = await checkServiceHealth(binding, name);
        return result;
      }),
    );

    const healthy = checks.filter((s) => s.status === 'healthy');
    const degraded = checks.filter((s) => s.status === 'degraded');
    const unreachable = checks.filter((s) => s.status === 'unreachable');

    let verdict: 'ready' | 'degraded' | 'blocked' = 'ready';
    if (unreachable.length > 0) {
      verdict = 'blocked';
    } else if (degraded.length > 0) {
      verdict = 'degraded';
    }

    return c.json({
      verdict,
      timestamp: new Date().toISOString(),
      summary: {
        total: checks.length,
        healthy: healthy.length,
        degraded: degraded.length,
        unreachable: unreachable.length,
      },
      services: checks,
    });
  });

  /**
   * POST /rollback-drill
   *
   * Simulates a rollback by verifying all services are reachable and
   * could accept traffic if a deploy were rolled back. Records drill outcome.
   */
  app.post('/rollback-drill', async (c) => {
    const services = getServiceBindings(c.env);
    const drillId = crypto.randomUUID();
    const startedAt = new Date();

    const checks = await Promise.all(
      services.map(async ({ name, binding }) => {
        const start = Date.now();
        const result = await checkServiceHealth(binding, name);
        const latencyMs = Date.now() - start;
        return { ...result, latencyMs };
      }),
    );

    const allHealthy = checks.every((s) => s.status === 'healthy');
    const completedAt = new Date();

    const drillResult = {
      drillId,
      outcome: allHealthy ? ('pass' as const) : ('fail' as const),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.valueOf() - startedAt.valueOf(),
      services: checks,
    };

    // Persist drill result in KV for audit trail
    try {
      await c.env.KV.put(
        `ops:rollback-drill:${drillId}`,
        JSON.stringify(drillResult),
        { expirationTtl: 90 * 24 * 60 * 60 }, // 90 days
      );
    } catch {
      // Best-effort persistence — don't fail the drill
    }

    return c.json(drillResult, allHealthy ? 200 : 503);
  });

  return app;
}

interface ServiceCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unreachable';
  statusCode: number | null;
  message: string;
}

function getServiceBindings(
  env: Env['Bindings'],
): Array<{ name: string; binding: Fetcher }> {
  const pairs: Array<{ name: string; binding: Fetcher | undefined }> = [
    { name: 'identity', binding: env.IDENTITY },
    { name: 'billing', binding: env.BILLING },
    { name: 'crm', binding: env.CRM },
    { name: 'delivery', binding: env.DELIVERY },
    { name: 'campaign', binding: env.CAMPAIGN },
    { name: 'journey', binding: env.JOURNEY },
    { name: 'content', binding: env.CONTENT },
    { name: 'analytics', binding: env.ANALYTICS },
    { name: 'integrations', binding: env.INTEGRATIONS },
    { name: 'lead-intelligence', binding: env.LEAD_INTELLIGENCE },
    { name: 'scoring', binding: env.SCORING },
    { name: 'revops', binding: env.REVOPS },
  ];

  return pairs.filter(
    (p): p is { name: string; binding: Fetcher } => p.binding != null,
  );
}

async function checkServiceHealth(
  binding: Fetcher,
  name: string,
): Promise<ServiceCheck> {
  try {
    const response = await binding.fetch('https://internal/health', {
      method: 'GET',
    });

    if (response.ok) {
      return {
        name,
        status: 'healthy',
        statusCode: response.status,
        message: 'ok',
      };
    }

    return {
      name,
      status: 'degraded',
      statusCode: response.status,
      message: `Health check returned ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: 'unreachable',
      statusCode: null,
      message: String(error),
    };
  }
}
