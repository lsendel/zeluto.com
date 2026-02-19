import { Hono } from 'hono';
import type { Env } from '../app.js';

export const forecastRoutes = new Hono<Env>();

forecastRoutes.get('/api/v1/revops/forecasts/:period', async (c) => {
  const { period } = c.req.param();
  // TODO: Wire up ForecastRepository
  return c.json({ period, pipelineValue: 0, bestCaseValue: 0, commitValue: 0, closedValue: 0, weightedValue: 0 });
});

forecastRoutes.get('/api/v1/revops/pipeline/metrics', async (c) => {
  // TODO: Wire up DealRepository.countByStage
  return c.json({ totalDeals: 0, totalValue: 0, avgDealSize: 0, stageBreakdown: {}, winRate: 0 });
});
