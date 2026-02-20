import type { TenantContext } from '@mauntic/domain-kernel';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../app.js';
import {
  findTemplateById,
  updateTemplate,
} from '../infrastructure/repositories/template-repository.js';
import { templateRoutes } from './template-routes.js';

vi.mock('../infrastructure/repositories/template-repository.js', () => ({
  createTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  findAllTemplates: vi.fn(),
  findTemplateById: vi.fn(),
  updateTemplate: vi.fn(),
}));

function createTestApp(db: NeonHttpDatabase): Hono<Env> {
  const app = new Hono<Env>();
  app.use('/api/*', async (c, next) => {
    c.set('db', db);
    c.set('tenant', {
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'owner',
      plan: 'pro',
    } as TenantContext);
    await next();
  });
  app.route('/', templateRoutes);
  return app;
}

function buildTemplateFixture() {
  return {
    id: 'tpl-1',
    organizationId: 'org-1',
    name: 'Welcome template',
    type: 'email',
    category: null,
    subject: 'Welcome',
    bodyHtml:
      '<section>{{block:hero}}</section><footer>{{block:footer}}</footer>',
    bodyText: null,
    bodyJson: {
      blocks: [{ key: 'hero', html: '<h1>Default Hero</h1>' }],
      experiments: [
        {
          key: 'hero_copy',
          status: 'active',
          variants: [
            {
              key: 'a',
              weight: 50,
              blockOverrides: { hero: '<h1>A Hero</h1>' },
            },
            {
              key: 'b',
              weight: 50,
              blockOverrides: { hero: '<h1>B Hero</h1>' },
            },
          ],
        },
      ],
    },
    thumbnailUrl: null,
    isActive: true,
    createdBy: 'user-1',
    createdAt: new Date('2026-02-20T00:00:00.000Z'),
    updatedAt: new Date('2026-02-20T00:00:00.000Z'),
  };
}

describe('template routes composition integration', () => {
  const db = {} as NeonHttpDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders preview with shared blocks and forced experiment variant', async () => {
    vi.mocked(findTemplateById).mockResolvedValue(
      buildTemplateFixture() as Awaited<ReturnType<typeof findTemplateById>>,
    );

    const app = createTestApp(db);
    const response = await app.request(
      'http://localhost/api/v1/content/templates/tpl-1/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: 'visitor-123',
          forcedVariants: { hero_copy: 'b' },
          sharedBlocks: [{ key: 'footer', html: '<p>Shared Footer</p>' }],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(findTemplateById).toHaveBeenCalledWith(db, 'org-1', 'tpl-1');

    const payload = await response.json<{
      html: string;
      appliedVariants: Record<string, string>;
      blocks: Array<{ key: string }>;
      experiments: Array<{ key: string }>;
    }>();
    expect(payload.html).toContain('<h1>B Hero</h1>');
    expect(payload.html).toContain('<p>Shared Footer</p>');
    expect(payload.appliedVariants).toEqual({ hero_copy: 'b' });
    expect(payload.blocks).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'hero' })]),
    );
    expect(payload.experiments).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'hero_copy' })]),
    );
  });

  it('upserts reusable block and persists merged bodyJson', async () => {
    const template = buildTemplateFixture();
    vi.mocked(findTemplateById).mockResolvedValue(
      template as Awaited<ReturnType<typeof findTemplateById>>,
    );
    vi.mocked(updateTemplate).mockImplementation(async (...args) => {
      const data = args[3] as { bodyJson?: unknown } | undefined;
      return {
        ...template,
        bodyJson: data?.bodyJson,
        updatedAt: new Date('2026-02-20T10:00:00.000Z'),
      } as Awaited<ReturnType<typeof updateTemplate>>;
    });

    const app = createTestApp(db);
    const response = await app.request(
      'http://localhost/api/v1/content/templates/tpl-1/blocks/hero',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: '<h1>Updated Hero</h1>' }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateTemplate).toHaveBeenCalledTimes(1);
    const [, , , data] = vi.mocked(updateTemplate).mock.calls[0] ?? [];
    expect(data).toEqual(
      expect.objectContaining({
        bodyJson: expect.objectContaining({
          blocks: expect.arrayContaining([
            expect.objectContaining({
              key: 'hero',
              html: '<h1>Updated Hero</h1>',
            }),
          ]),
          experiments: expect.any(Array),
        }),
      }),
    );

    const payload = await response.json<{
      bodyJson: Record<string, unknown>;
    }>();
    const payloadBlocks = (payload.bodyJson as { blocks?: unknown }).blocks;
    expect(payloadBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'hero', html: '<h1>Updated Hero</h1>' }),
      ]),
    );
  });

  it('deletes reusable block and persists updated model', async () => {
    const template = {
      ...buildTemplateFixture(),
      bodyJson: {
        blocks: [
          { key: 'hero', html: '<h1>Hero</h1>' },
          { key: 'footer', html: '<p>Footer</p>' },
        ],
        experiments: [],
      },
    };
    vi.mocked(findTemplateById).mockResolvedValue(
      template as Awaited<ReturnType<typeof findTemplateById>>,
    );
    vi.mocked(updateTemplate).mockImplementation(async (...args) => {
      const data = args[3] as { bodyJson?: unknown } | undefined;
      return {
        ...template,
        bodyJson: data?.bodyJson,
      } as Awaited<ReturnType<typeof updateTemplate>>;
    });

    const app = createTestApp(db);
    const response = await app.request(
      'http://localhost/api/v1/content/templates/tpl-1/blocks/footer',
      {
        method: 'DELETE',
      },
    );

    expect(response.status).toBe(200);
    const [, , , data] = vi.mocked(updateTemplate).mock.calls[0] ?? [];
    expect(data).toEqual(
      expect.objectContaining({
        bodyJson: expect.objectContaining({
          blocks: [expect.objectContaining({ key: 'hero' })],
        }),
      }),
    );
    expect(
      (data.bodyJson as { blocks?: Array<{ key: string }> }).blocks?.some(
        (block) => block.key === 'footer',
      ),
    ).toBe(false);
  });

  it('upserts experiment variants and rejects invalid variant payloads', async () => {
    const template = buildTemplateFixture();
    vi.mocked(findTemplateById).mockResolvedValue(
      template as Awaited<ReturnType<typeof findTemplateById>>,
    );
    vi.mocked(updateTemplate).mockImplementation(async (...args) => {
      const data = args[3] as { bodyJson?: unknown } | undefined;
      return {
        ...template,
        bodyJson: data?.bodyJson,
      } as Awaited<ReturnType<typeof updateTemplate>>;
    });

    const app = createTestApp(db);
    const successResponse = await app.request(
      'http://localhost/api/v1/content/templates/tpl-1/experiments/footer_copy',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          variants: [
            {
              key: 'a',
              weight: 100,
              blockOverrides: { footer: '<p>A Footer</p>' },
            },
          ],
        }),
      },
    );

    expect(successResponse.status).toBe(200);
    expect(updateTemplate).toHaveBeenCalledTimes(1);

    const badResponse = await app.request(
      'http://localhost/api/v1/content/templates/tpl-1/experiments/invalid',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'active',
          variants: [],
        }),
      },
    );

    expect(badResponse.status).toBe(400);
    await expect(badResponse.json()).resolves.toEqual({
      code: 'VALIDATION_ERROR',
      message: 'Experiment variants with positive weight are required',
    });
    expect(updateTemplate).toHaveBeenCalledTimes(1);
  });
});
