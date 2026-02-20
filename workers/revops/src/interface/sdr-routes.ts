import { SDRAgent } from '@mauntic/revops-domain';
import { Hono } from 'hono';
import { ClaudeLLMProvider } from '../adapters/claude-llm-provider.js';
import type { Env } from '../app.js';
import {
  findProspectsByOrganization,
  upsertProspect,
} from '../infrastructure/repositories/prospect-repository.js';
import {
  createSequence,
  enrollContact,
  findSequencesByOrganization,
} from '../infrastructure/repositories/sequence-repository.js';

export const sdrRoutes = new Hono<Env>();

sdrRoutes.get('/api/v1/revops/prospects', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const prospects = await findProspectsByOrganization(
      db,
      tenant.organizationId,
    );
    return c.json(prospects);
  } catch (error) {
    console.error('List prospects error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list prospects' },
      500,
    );
  }
});

sdrRoutes.post('/api/v1/revops/prospects/:contactId/qualify', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { contactId } = c.req.param();

  try {
    const llm = new ClaudeLLMProvider(c.env.ANTHROPIC_API_KEY);
    const sdrAgent = new SDRAgent(llm, {
      mode: 'copilot',
      minQualificationScore: 50,
      minDataCompleteness: 0.6,
      icpCriteria: {},
    });

    const body = await c.req.json().catch(() => ({}));
    const qualification = await sdrAgent.qualify({
      contactId,
      organizationId: tenant.organizationId,
      leadScore: body.leadScore ?? 0,
      dataCompleteness: body.dataCompleteness ?? 0,
      contactData: body.contactData ?? {},
    });

    const prospect = await upsertProspect(db, tenant.organizationId, {
      contact_id: contactId,
      qualification_score: qualification.qualificationScore,
      icp_match: String(qualification.icpMatch),
      reasoning: qualification.reasoning,
      recommendation: qualification.recommendation,
      data_completeness: String(body.dataCompleteness ?? 0),
      qualified_at: new Date(),
    });

    return c.json({ ...prospect, qualification });
  } catch (error) {
    console.error('Qualify prospect error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to qualify prospect' },
      500,
    );
  }
});

sdrRoutes.get('/api/v1/revops/sequences', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const seqs = await findSequencesByOrganization(db, tenant.organizationId);
    return c.json(seqs);
  } catch (error) {
    console.error('List sequences error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list sequences' },
      500,
    );
  }
});

sdrRoutes.post('/api/v1/revops/sequences', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  try {
    const body = await c.req.json();
    const seq = await createSequence(db, tenant.organizationId, body);
    return c.json(seq, 201);
  } catch (error) {
    console.error('Create sequence error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create sequence' },
      500,
    );
  }
});

sdrRoutes.post('/api/v1/revops/sequences/:sequenceId/enroll', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const { sequenceId } = c.req.param();

  try {
    const body = await c.req.json<{ contactId: string }>();
    const enrollment = await enrollContact(db, tenant.organizationId, {
      sequence_id: sequenceId,
      contact_id: body.contactId,
    });

    return c.json(enrollment, 201);
  } catch (error) {
    console.error('Enroll in sequence error:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to enroll in sequence' },
      500,
    );
  }
});
