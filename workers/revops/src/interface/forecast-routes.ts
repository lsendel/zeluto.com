import {
  ForecastCalibration,
  type ForecastActualPair,
} from '@mauntic/revops-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import { countDealsByStage } from '../infrastructure/repositories/deal-repository.js';
import {
  findForecastByPeriod,
  findForecastHistory,
} from '../infrastructure/repositories/forecast-repository.js';

export const forecastRoutes = new Hono<Env>();

forecastRoutes.get('/api/v1/revops/forecasts/:period', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { period } = c.req.param();

  try {
    const forecast = await findForecastByPeriod(
      db,
      tenant.organizationId,
      period,
    );
    if (!forecast) {
      return c.json({
        period,
        pipelineValue: '0',
        bestCaseValue: '0',
        commitValue: '0',
        closedValue: '0',
        weightedValue: '0',
      });
    }
    return c.json(forecast);
  } catch (error) {
    console.error('Get forecast error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get forecast' },
      500,
    );
  }
});

forecastRoutes.get('/api/v1/revops/pipeline/metrics', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const stages = await countDealsByStage(db, tenant.organizationId);
    const totalDeals = stages.reduce((sum, s) => sum + s.count, 0);
    const totalValue = stages.reduce(
      (sum, s) => sum + parseFloat(s.totalValue),
      0,
    );

    return c.json({
      totalDeals,
      totalValue,
      avgDealSize: totalDeals > 0 ? totalValue / totalDeals : 0,
      stageBreakdown: Object.fromEntries(
        stages.map((s) => [
          s.stage,
          { count: s.count, value: parseFloat(s.totalValue) },
        ]),
      ),
      winRate: 0,
    });
  } catch (error) {
    console.error('Get pipeline metrics error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get pipeline metrics' },
      500,
    );
  }
});

// ── Forecast Calibration ──────────────────────────────

forecastRoutes.get(
  '/api/v1/revops/forecasts/:period/calibration',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const { period } = c.req.param();

    try {
      const forecast = await findForecastByPeriod(
        db,
        tenant.organizationId,
        period,
      );
      if (!forecast) {
        return c.json(
          { error: `No forecast found for period ${period}` },
          404,
        );
      }

      const historyRows = await findForecastHistory(
        db,
        tenant.organizationId,
        period,
      );

      const history: ForecastActualPair[] = historyRows.map((row) => ({
        period: row.period,
        forecastedValue: parseFloat(row.weighted_value),
        actualValue: parseFloat(row.closed_value),
      }));

      const calibration = new ForecastCalibration();
      const report = calibration.calibrate(
        parseFloat(forecast.weighted_value),
        history,
      );

      return c.json(report);
    } catch (error) {
      console.error('Forecast calibration error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate calibration report',
        },
        500,
      );
    }
  },
);

forecastRoutes.get(
  '/api/v1/revops/forecasts/:period/risk-alerts',
  async (c) => {
    const tenant = c.get('tenant');
    const db = c.get('db');
    const { period } = c.req.param();

    try {
      const forecast = await findForecastByPeriod(
        db,
        tenant.organizationId,
        period,
      );
      if (!forecast) {
        return c.json(
          { error: `No forecast found for period ${period}` },
          404,
        );
      }

      const historyRows = await findForecastHistory(
        db,
        tenant.organizationId,
        period,
      );

      const history: ForecastActualPair[] = historyRows.map((row) => ({
        period: row.period,
        forecastedValue: parseFloat(row.weighted_value),
        actualValue: parseFloat(row.closed_value),
      }));

      const calibration = new ForecastCalibration();
      const report = calibration.calibrate(
        parseFloat(forecast.weighted_value),
        history,
      );

      return c.json({ period, alerts: report.alerts });
    } catch (error) {
      console.error('Forecast risk alerts error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate risk alerts',
        },
        500,
      );
    }
  },
);
