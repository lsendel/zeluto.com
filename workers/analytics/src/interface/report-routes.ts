import { Hono } from 'hono';
import type { Env } from '../app.js';
import { runTypedReport } from '../application/report-runner.js';
import {
  createReport,
  deleteReport,
  findAllReports,
  findReportById,
  updateReport,
} from '../infrastructure/repositories/report-repository.js';

export const reportRoutes = new Hono<Env>();

// GET /api/v1/analytics/reports - List reports (paginated)
reportRoutes.get('/api/v1/analytics/reports', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25' } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllReports(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List reports error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list reports' },
      500,
    );
  }
});

// POST /api/v1/analytics/reports - Create report
reportRoutes.post('/api/v1/analytics/reports', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      name: string;
      type?: string;
      config?: Record<string, unknown>;
    }>();

    if (!body.name) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'name is required' },
        400,
      );
    }

    const report = await createReport(db, tenant.organizationId, {
      name: body.name,
      steps: body.config ?? { type: body.type ?? 'custom' },
      createdBy: tenant.userId,
    });

    return c.json(report, 201);
  } catch (error) {
    console.error('Create report error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create report' },
      500,
    );
  }
});

// GET /api/v1/analytics/reports/:id - Get report by ID
reportRoutes.get('/api/v1/analytics/reports/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const report = await findReportById(db, tenant.organizationId, id);
    if (!report) {
      return c.json({ code: 'NOT_FOUND', message: 'Report not found' }, 404);
    }
    return c.json(report);
  } catch (error) {
    console.error('Get report error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get report' },
      500,
    );
  }
});

// PATCH /api/v1/analytics/reports/:id - Update report
reportRoutes.patch('/api/v1/analytics/reports/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      name?: string;
      config?: Record<string, unknown>;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.config !== undefined) updateData.steps = body.config;

    const report = await updateReport(
      db,
      tenant.organizationId,
      id,
      updateData,
    );
    if (!report) {
      return c.json({ code: 'NOT_FOUND', message: 'Report not found' }, 404);
    }

    return c.json(report);
  } catch (error) {
    console.error('Update report error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update report' },
      500,
    );
  }
});

// DELETE /api/v1/analytics/reports/:id - Delete report
reportRoutes.delete('/api/v1/analytics/reports/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteReport(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Report not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete report error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to delete report' },
      500,
    );
  }
});

// POST /api/v1/analytics/reports/:id/run - Run a report
reportRoutes.post('/api/v1/analytics/reports/:id/run', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const report = await findReportById(db, tenant.organizationId, id);
    if (!report) {
      return c.json({ code: 'NOT_FOUND', message: 'Report not found' }, 404);
    }

    // Parse optional date range from body
    let startDate: string | undefined;
    let endDate: string | undefined;
    try {
      const body = await c.req.json<{ startDate?: string; endDate?: string }>();
      startDate = body.startDate;
      endDate = body.endDate;
    } catch {
      // No body is fine
    }

    // Mark report as run
    await updateReport(db, tenant.organizationId, id, {});

    const result = await runTypedReport(db, tenant.organizationId, report, {
      startDate,
      endDate,
    });

    return c.json(result);
  } catch (error) {
    console.error('Run report error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to run report' },
      500,
    );
  }
});
