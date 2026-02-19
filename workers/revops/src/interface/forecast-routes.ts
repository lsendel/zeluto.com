import { Hono } from 'hono';
import type { Env } from '../app.js';
import { findForecastByPeriod } from '../infrastructure/repositories/forecast-repository.js';
import { countDealsByStage } from '../infrastructure/repositories/deal-repository.js';

export const forecastRoutes = new Hono<Env>();

forecastRoutes.get('/api/v1/revops/forecasts/:period', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { period } = c.req.param();

  try {
    const forecast = await findForecastByPeriod(db, tenant.organizationId, period);
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
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get forecast' }, 500);
  }
});

forecastRoutes.get('/api/v1/revops/pipeline/metrics', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const stages = await countDealsByStage(db, tenant.organizationId);
    const totalDeals = stages.reduce((sum, s) => sum + s.count, 0);
    const totalValue = stages.reduce((sum, s) => sum + parseFloat(s.totalValue), 0);

    return c.json({
      totalDeals,
      totalValue,
      avgDealSize: totalDeals > 0 ? totalValue / totalDeals : 0,
      stageBreakdown: Object.fromEntries(stages.map((s) => [s.stage, { count: s.count, value: parseFloat(s.totalValue) }])),
      winRate: 0,
    });
  } catch (error) {
    console.error('Get pipeline metrics error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get pipeline metrics' }, 500);
  }
});
