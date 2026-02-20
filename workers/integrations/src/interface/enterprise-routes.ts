import {
  type ConflictResolutionStrategy,
  ConflictResolutionStrategySchema,
  InvalidPromotionPathError,
  InvalidPromotionStatusTransitionError,
} from '@mauntic/integrations-domain';
import { Hono } from 'hono';
import type { Env } from '../app.js';
import {
  ensureCrmConflictPolicy,
  resolveCrmConflictPreview,
  upsertCrmConflictPolicy,
} from '../application/crm-conflict-policy-store.js';
import {
  applyEnvironmentPromotion,
  approveEnvironmentPromotion,
  createEnvironmentPromotion,
  listEnvironmentPromotions,
  rejectEnvironmentPromotion,
} from '../application/environment-promotion-store.js';

export const enterpriseRoutes = new Hono<Env>();

enterpriseRoutes.get(
  '/api/v1/integrations/environment-promotions',
  async (c) => {
    const tenant = c.get('tenant');
    const promotions = await listEnvironmentPromotions(
      c.env.KV,
      tenant.organizationId,
    );
    return c.json({ data: promotions });
  },
);

enterpriseRoutes.post(
  '/api/v1/integrations/environment-promotions',
  async (c) => {
    const tenant = c.get('tenant');
    try {
      const body = await c.req.json<{
        sourceEnvironment: 'dev' | 'stage' | 'prod';
        targetEnvironment: 'dev' | 'stage' | 'prod';
        scope: {
          connectionIds?: string[];
          oauthAppIds?: string[];
          webhookIds?: string[];
        };
        notes?: string | null;
      }>();

      const promotion = await createEnvironmentPromotion(c.env.KV, {
        organizationId: tenant.organizationId,
        sourceEnvironment: body.sourceEnvironment,
        targetEnvironment: body.targetEnvironment,
        scope: {
          connectionIds: body.scope?.connectionIds ?? [],
          oauthAppIds: body.scope?.oauthAppIds ?? [],
          webhookIds: body.scope?.webhookIds ?? [],
        },
        notes: body.notes ?? null,
        requestedBy: tenant.userId,
      });
      return c.json(promotion, 201);
    } catch (error) {
      if (error instanceof InvalidPromotionPathError) {
        return c.json(
          { code: 'VALIDATION_ERROR', message: error.message },
          400,
        );
      }
      if (
        error instanceof Error &&
        error.message.includes('Promotion scope must include')
      ) {
        return c.json(
          { code: 'VALIDATION_ERROR', message: error.message },
          400,
        );
      }
      console.error('Create environment promotion error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create promotion request',
        },
        500,
      );
    }
  },
);

enterpriseRoutes.post(
  '/api/v1/integrations/environment-promotions/:id/approve',
  async (c) => {
    const tenant = c.get('tenant');
    try {
      const promotion = await approveEnvironmentPromotion(c.env.KV, {
        organizationId: tenant.organizationId,
        promotionId: c.req.param('id'),
        reviewedBy: tenant.userId,
      });
      if (!promotion) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Promotion request not found' },
          404,
        );
      }
      return c.json(promotion);
    } catch (error) {
      if (error instanceof InvalidPromotionStatusTransitionError) {
        return c.json({ code: 'CONFLICT', message: error.message }, 409);
      }
      console.error('Approve environment promotion error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to approve promotion request',
        },
        500,
      );
    }
  },
);

enterpriseRoutes.post(
  '/api/v1/integrations/environment-promotions/:id/reject',
  async (c) => {
    const tenant = c.get('tenant');
    const body = await c.req
      .json<{
        reason?: string;
      }>()
      .catch(() => null);
    const rejectionReason = body?.reason?.trim();
    if (!rejectionReason) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Rejection reason is required',
        },
        400,
      );
    }

    try {
      const promotion = await rejectEnvironmentPromotion(c.env.KV, {
        organizationId: tenant.organizationId,
        promotionId: c.req.param('id'),
        reviewedBy: tenant.userId,
        reason: rejectionReason,
      });
      if (!promotion) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Promotion request not found' },
          404,
        );
      }
      return c.json(promotion);
    } catch (error) {
      if (error instanceof InvalidPromotionStatusTransitionError) {
        return c.json({ code: 'CONFLICT', message: error.message }, 409);
      }
      console.error('Reject environment promotion error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reject promotion request',
        },
        500,
      );
    }
  },
);

enterpriseRoutes.post(
  '/api/v1/integrations/environment-promotions/:id/apply',
  async (c) => {
    const tenant = c.get('tenant');
    try {
      const promotion = await applyEnvironmentPromotion(c.env.KV, {
        organizationId: tenant.organizationId,
        promotionId: c.req.param('id'),
      });
      if (!promotion) {
        return c.json(
          { code: 'NOT_FOUND', message: 'Promotion request not found' },
          404,
        );
      }
      return c.json(promotion);
    } catch (error) {
      if (error instanceof InvalidPromotionStatusTransitionError) {
        return c.json({ code: 'CONFLICT', message: error.message }, 409);
      }
      console.error('Apply environment promotion error:', error);
      return c.json(
        {
          code: 'INTERNAL_ERROR',
          message: 'Failed to apply promotion request',
        },
        500,
      );
    }
  },
);

enterpriseRoutes.get(
  '/api/v1/integrations/crm/conflict-policies/options',
  (c) => {
    return c.json({
      strategies: [
        {
          key: 'crm_wins',
          label: 'CRM wins',
          description: 'Use provider values whenever there is a conflict.',
        },
        {
          key: 'mauntic_wins',
          label: 'Mauntic wins',
          description:
            'Keep local platform values whenever there is a conflict.',
        },
        {
          key: 'most_recent_wins',
          label: 'Most recent wins',
          description: 'Choose the side with the newest updated timestamp.',
        },
        {
          key: 'manual_review',
          label: 'Manual review',
          description: 'Queue conflicts for an admin decision.',
        },
      ],
    });
  },
);

enterpriseRoutes.get(
  '/api/v1/integrations/crm/conflict-policies',
  async (c) => {
    const tenant = c.get('tenant');
    const connectionId = c.req.query('connectionId');
    const policy = await ensureCrmConflictPolicy(c.env.KV, {
      organizationId: tenant.organizationId,
      connectionId,
      actorUserId: tenant.userId,
    });
    return c.json(policy);
  },
);

enterpriseRoutes.put(
  '/api/v1/integrations/crm/conflict-policies',
  async (c) => {
    const tenant = c.get('tenant');
    const body = await c.req.json<{
      connectionId?: string;
      defaultStrategy?: string;
      fieldStrategies?: Record<string, string>;
    }>();

    const parsedDefaultStrategy =
      body.defaultStrategy !== undefined
        ? ConflictResolutionStrategySchema.safeParse(body.defaultStrategy)
        : undefined;
    if (parsedDefaultStrategy && !parsedDefaultStrategy.success) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'defaultStrategy is invalid',
        },
        400,
      );
    }

    const parsedFieldStrategies = body.fieldStrategies
      ? Object.entries(body.fieldStrategies).reduce<
          Record<string, ConflictResolutionStrategy>
        >((acc, [field, strategy]) => {
          const parsed = ConflictResolutionStrategySchema.safeParse(strategy);
          if (parsed.success) {
            acc[field] = parsed.data;
          }
          return acc;
        }, {})
      : undefined;

    if (
      body.fieldStrategies &&
      parsedFieldStrategies &&
      Object.keys(parsedFieldStrategies).length !==
        Object.keys(body.fieldStrategies).length
    ) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'fieldStrategies contains invalid strategy values',
        },
        400,
      );
    }

    const policy = await upsertCrmConflictPolicy(c.env.KV, {
      organizationId: tenant.organizationId,
      connectionId: body.connectionId,
      actorUserId: tenant.userId,
      defaultStrategy: parsedDefaultStrategy?.data,
      fieldStrategies: parsedFieldStrategies,
    });
    return c.json(policy);
  },
);

enterpriseRoutes.post(
  '/api/v1/integrations/crm/conflict-policies/resolve',
  async (c) => {
    const tenant = c.get('tenant');
    const body = await c.req.json<{
      connectionId?: string;
      field: string;
      localValue?: unknown;
      remoteValue?: unknown;
      localUpdatedAt?: string;
      remoteUpdatedAt?: string;
    }>();

    if (!body.field?.trim()) {
      return c.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'field is required',
        },
        400,
      );
    }

    const resolution = await resolveCrmConflictPreview(c.env.KV, {
      organizationId: tenant.organizationId,
      connectionId: body.connectionId,
      actorUserId: tenant.userId,
      conflict: {
        field: body.field,
        localUpdatedAt: body.localUpdatedAt,
        remoteUpdatedAt: body.remoteUpdatedAt,
      },
    });

    const resolvedValue =
      resolution.decision.side === 'crm'
        ? body.remoteValue
        : resolution.decision.side === 'mauntic'
          ? body.localValue
          : null;

    return c.json({
      policy: resolution.policy,
      decision: resolution.decision,
      field: body.field,
      resolvedValue,
    });
  },
);
