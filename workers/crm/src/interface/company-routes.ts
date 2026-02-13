import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  findCompanyById,
  findAllCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
} from '../infrastructure/repositories/company-repository.js';

export const companyRoutes = new Hono<Env>();

// GET /api/v1/crm/companies - List companies (paginated, searchable)
companyRoutes.get('/api/v1/crm/companies', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { page = '1', limit = '25', search } = c.req.query();

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  try {
    const result = await findAllCompanies(db, tenant.organizationId, {
      page: pageNum,
      limit: limitNum,
      search: search || undefined,
    });

    return c.json({
      data: result.data,
      total: result.total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(result.total / limitNum),
    });
  } catch (error) {
    console.error('List companies error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to list companies' }, 500);
  }
});

// POST /api/v1/crm/companies - Create company
companyRoutes.post('/api/v1/crm/companies', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json<{
      name: string;
      domain?: string;
      industry?: string;
      size?: string;
      customFields?: Record<string, unknown>;
    }>();

    if (!body.name || body.name.trim().length === 0) {
      return c.json(
        { code: 'VALIDATION_ERROR', message: 'Company name is required' },
        400,
      );
    }

    const company = await createCompany(db, tenant.organizationId, {
      name: body.name,
      domain: body.domain ?? null,
      industry: body.industry ?? null,
      size: body.size ?? null,
      custom_fields: body.customFields ?? null,
    });

    return c.json(company, 201);
  } catch (error) {
    console.error('Create company error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to create company' }, 500);
  }
});

// GET /api/v1/crm/companies/:id - Get company by ID
companyRoutes.get('/api/v1/crm/companies/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const company = await findCompanyById(db, tenant.organizationId, id);
    if (!company) {
      return c.json({ code: 'NOT_FOUND', message: 'Company not found' }, 404);
    }
    return c.json(company);
  } catch (error) {
    console.error('Get company error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to get company' }, 500);
  }
});

// PATCH /api/v1/crm/companies/:id - Update company
companyRoutes.patch('/api/v1/crm/companies/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const body = await c.req.json<{
      name?: string;
      domain?: string;
      industry?: string;
      size?: string;
      customFields?: Record<string, unknown>;
    }>();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.domain !== undefined) updateData.domain = body.domain;
    if (body.industry !== undefined) updateData.industry = body.industry;
    if (body.size !== undefined) updateData.size = body.size;
    if (body.customFields !== undefined) updateData.custom_fields = body.customFields;

    const company = await updateCompany(db, tenant.organizationId, id, updateData);
    if (!company) {
      return c.json({ code: 'NOT_FOUND', message: 'Company not found' }, 404);
    }

    return c.json(company);
  } catch (error) {
    console.error('Update company error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to update company' }, 500);
  }
});

// DELETE /api/v1/crm/companies/:id - Delete company
companyRoutes.delete('/api/v1/crm/companies/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const id = c.req.param('id');

  try {
    const deleted = await deleteCompany(db, tenant.organizationId, id);
    if (!deleted) {
      return c.json({ code: 'NOT_FOUND', message: 'Company not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete company error:', error);
    return c.json({ code: 'INTERNAL_ERROR', message: 'Failed to delete company' }, 500);
  }
});
