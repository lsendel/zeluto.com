import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ErrorSchema,
  IdParamSchema,
  PaginationQuerySchema,
  PaginatedResponseSchema,
} from './common';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const CampaignSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  type: z.enum(['email', 'sms', 'push', 'multichannel']),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'canceled']),
  scheduledAt: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdBy: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CampaignVersionSchema = z.object({
  id: z.number(),
  campaignId: z.number(),
  versionNumber: z.number(),
  subject: z.string().nullable(),
  contentTemplateId: z.number().nullable(),
  segmentIds: z.array(z.number()),
  settings: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export const CampaignStatsSchema = z.object({
  id: z.number(),
  campaignId: z.number(),
  totalRecipients: z.number(),
  sent: z.number(),
  delivered: z.number(),
  opened: z.number(),
  clicked: z.number(),
  bounced: z.number(),
  complained: z.number(),
  unsubscribed: z.number(),
});

export const AbTestSchema = z.object({
  id: z.number(),
  campaignId: z.number(),
  name: z.string(),
  variants: z.array(z.record(z.string(), z.unknown())),
  winningCriteria: z.enum(['opens', 'clicks', 'conversions']),
  winnerVariant: z.number().nullable(),
  status: z.enum(['running', 'completed', 'canceled']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const CreateCampaignBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['email', 'sms', 'push', 'multichannel']),
});

const UpdateCampaignBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'canceled']).optional(),
});

const SendCampaignBodySchema = z.object({
  versionId: z.number().optional(),
});

const ScheduleCampaignBodySchema = z.object({
  scheduledAt: z.string(),
  versionId: z.number().optional(),
});

const CreateAbTestBodySchema = z.object({
  campaignId: z.number(),
  name: z.string().min(1),
  variants: z.array(z.record(z.string(), z.unknown())),
  winningCriteria: z.enum(['opens', 'clicks', 'conversions']),
});

const SelectWinnerBodySchema = z.object({
  winnerVariant: z.number(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const campaignContract = c.router({
  campaigns: {
    list: {
      method: 'GET',
      path: '/api/v1/campaign/campaigns',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(CampaignSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/campaign/campaigns',
      body: CreateCampaignBodySchema,
      responses: {
        201: CampaignSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/campaign/campaigns/:id',
      pathParams: IdParamSchema,
      responses: {
        200: CampaignSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/campaign/campaigns/:id',
      pathParams: IdParamSchema,
      body: UpdateCampaignBodySchema,
      responses: {
        200: CampaignSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/campaign/campaigns/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    send: {
      method: 'POST',
      path: '/api/v1/campaign/campaigns/:id/send',
      pathParams: IdParamSchema,
      body: SendCampaignBodySchema.optional(),
      responses: {
        200: CampaignSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    schedule: {
      method: 'POST',
      path: '/api/v1/campaign/campaigns/:id/schedule',
      pathParams: IdParamSchema,
      body: ScheduleCampaignBodySchema,
      responses: {
        200: CampaignSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    pause: {
      method: 'POST',
      path: '/api/v1/campaign/campaigns/:id/pause',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: CampaignSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    resume: {
      method: 'POST',
      path: '/api/v1/campaign/campaigns/:id/resume',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: CampaignSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    stats: {
      method: 'GET',
      path: '/api/v1/campaign/campaigns/:id/stats',
      pathParams: IdParamSchema,
      responses: {
        200: CampaignStatsSchema,
        404: ErrorSchema,
      },
    },
    clone: {
      method: 'POST',
      path: '/api/v1/campaign/campaigns/:id/clone',
      pathParams: IdParamSchema,
      body: z.object({
        name: z.string().min(1).optional(),
      }).optional(),
      responses: {
        201: CampaignSchema,
        404: ErrorSchema,
      },
    },
  },
  abTests: {
    create: {
      method: 'POST',
      path: '/api/v1/campaign/ab-tests',
      body: CreateAbTestBodySchema,
      responses: {
        201: AbTestSchema,
        400: ErrorSchema,
      },
    },
    getResults: {
      method: 'GET',
      path: '/api/v1/campaign/ab-tests/:id/results',
      pathParams: IdParamSchema,
      responses: {
        200: AbTestSchema,
        404: ErrorSchema,
      },
    },
    selectWinner: {
      method: 'POST',
      path: '/api/v1/campaign/ab-tests/:id/select-winner',
      pathParams: IdParamSchema,
      body: SelectWinnerBodySchema,
      responses: {
        200: AbTestSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
});
