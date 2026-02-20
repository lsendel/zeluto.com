import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../app.js';
import { countDealsByStage } from '../infrastructure/repositories/deal-repository.js';
import {
  findForecastByPeriod,
  findForecastHistory,
} from '../infrastructure/repositories/forecast-repository.js';
import { forecastRoutes } from './forecast-routes.js';

vi.mock('../infrastructure/repositories/forecast-repository.js', () => ({
  findForecastByPeriod: vi.fn(),
  findForecastHistory: vi.fn(),
}));

vi.mock('../infrastructure/repositories/deal-repository.js', () => ({
  countDealsByStage: vi.fn(),
}));

function createTestApp() {
  const app = new Hono<{
    Bindings: Env['Bindings'];
    Variables: Env['Variables'];
  }>();
  app.use('/api/v1/revops/*', async (c, next) => {
    c.set('tenant', {
      organizationId: '11111111-1111-4111-8111-111111111111' as never,
      userId: '22222222-2222-4222-8222-222222222222' as never,
      userRole: 'owner',
      plan: 'enterprise',
    });
    c.set('db', {} as never);
    await next();
  });
  app.route('/', forecastRoutes);
  return app;
}

function baseEnv(overrides?: Partial<Env['Bindings']>): Env['Bindings'] {
  return {
    DATABASE_URL: 'postgres://db',
    KV: {} as KVNamespace,
    EVENTS: {} as Queue,
    ANTHROPIC_API_KEY: 'test-key',
    ...overrides,
  };
}

function buildForecastRow(overrides?: Record<string, unknown>) {
  return {
    id: 'aaaa1111-1111-4111-8111-111111111111',
    organization_id: '11111111-1111-4111-8111-111111111111',
    period: '2026-Q1',
    rep_id: null,
    pipeline_value: '100000.00',
    best_case_value: '80000.00',
    commit_value: '60000.00',
    closed_value: '40000.00',
    weighted_value: '145000.00', // 40k + 60k + 40k + 25k
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-02-15'),
    ...overrides,
  };
}

describe('forecast routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countDealsByStage).mockResolvedValue([]);
  });

  describe('GET /api/v1/revops/forecasts/:period/calibration', () => {
    it('returns calibration report with confidence bands', async () => {
      vi.mocked(findForecastByPeriod).mockResolvedValue(
        buildForecastRow() as never,
      );
      vi.mocked(findForecastHistory).mockResolvedValue([
        buildForecastRow({
          period: '2025-Q4',
          weighted_value: '120000.00',
          closed_value: '110000.00',
        }),
        buildForecastRow({
          period: '2025-Q3',
          weighted_value: '100000.00',
          closed_value: '95000.00',
        }),
        buildForecastRow({
          period: '2025-Q2',
          weighted_value: '90000.00',
          closed_value: '85000.00',
        }),
      ] as never);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/revops/forecasts/2026-Q1/calibration',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        metrics: { mape: number; bias: number; sampleSize: number };
        confidenceBand: {
          low: number;
          mid: number;
          high: number;
          confidenceLevel: number;
        };
        alerts: Array<{ severity: string; title: string }>;
      }>();

      expect(body.metrics.sampleSize).toBe(3);
      expect(body.metrics.mape).toBeGreaterThan(0);
      expect(body.confidenceBand.mid).toBe(145_000);
      expect(body.confidenceBand.confidenceLevel).toBe(0.8);
      expect(Array.isArray(body.alerts)).toBe(true);
    });

    it('returns 404 when forecast not found', async () => {
      vi.mocked(findForecastByPeriod).mockResolvedValue(null);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/revops/forecasts/2026-Q1/calibration',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(404);
    });

    it('returns default bands with no historical data', async () => {
      vi.mocked(findForecastByPeriod).mockResolvedValue(
        buildForecastRow() as never,
      );
      vi.mocked(findForecastHistory).mockResolvedValue([]);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/revops/forecasts/2026-Q1/calibration',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        metrics: { sampleSize: number };
        confidenceBand: { low: number; high: number };
      }>();

      expect(body.metrics.sampleSize).toBe(0);
      // Default +/- 20% of 145000
      expect(body.confidenceBand.low).toBe(116_000);
      expect(body.confidenceBand.high).toBe(174_000);
    });
  });

  describe('GET /api/v1/revops/forecasts/:period/risk-alerts', () => {
    it('returns risk alerts for the period', async () => {
      vi.mocked(findForecastByPeriod).mockResolvedValue(
        buildForecastRow() as never,
      );
      vi.mocked(findForecastHistory).mockResolvedValue([
        buildForecastRow({
          period: '2025-Q4',
          weighted_value: '100000.00',
          closed_value: '50000.00', // Very poor accuracy
        }),
        buildForecastRow({
          period: '2025-Q3',
          weighted_value: '90000.00',
          closed_value: '45000.00',
        }),
      ] as never);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/revops/forecasts/2026-Q1/risk-alerts',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(200);
      const body = await response.json<{
        period: string;
        alerts: Array<{ severity: string; title: string }>;
      }>();

      expect(body.period).toBe('2026-Q1');
      expect(body.alerts.length).toBeGreaterThan(0);
      // Should have accuracy-related alerts given 50% actual vs forecast
      const hasCritical = body.alerts.some(
        (a) => a.severity === 'critical' || a.severity === 'warning',
      );
      expect(hasCritical).toBe(true);
    });

    it('returns 404 when forecast not found', async () => {
      vi.mocked(findForecastByPeriod).mockResolvedValue(null);

      const app = createTestApp();
      const response = await app.request(
        'http://localhost/api/v1/revops/forecasts/2026-Q1/risk-alerts',
        undefined,
        baseEnv(),
      );

      expect(response.status).toBe(404);
    });
  });
});
