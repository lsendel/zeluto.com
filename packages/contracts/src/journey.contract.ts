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

export const JourneyStepSchema = z.object({
  id: z.string(),
  type: z.enum(['trigger', 'action', 'condition', 'delay', 'exit']),
  name: z.string(),
  config: z.record(z.unknown()),
  nextSteps: z.array(z.string()),
});

export const JourneySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['draft', 'active', 'paused', 'archived']),
  steps: z.array(JourneyStepSchema),
  triggerType: z.enum(['segment', 'event', 'manual']).nullable(),
  activeVersionId: z.number().nullable(),
  contactCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const JourneyVersionSchema = z.object({
  id: z.number(),
  journeyId: z.number(),
  version: z.number(),
  steps: z.array(JourneyStepSchema),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const CreateJourneyBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  triggerType: z.enum(['segment', 'event', 'manual']).optional(),
  steps: z.array(JourneyStepSchema).optional(),
});

const UpdateJourneyBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
  steps: z.array(JourneyStepSchema).optional(),
  triggerType: z.enum(['segment', 'event', 'manual']).optional(),
});

const CreateVersionBodySchema = z.object({
  steps: z.array(JourneyStepSchema),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const journeyContract = c.router({
  journeys: {
    list: {
      method: 'GET',
      path: '/api/v1/journeys',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(JourneySchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/journeys',
      body: CreateJourneyBodySchema,
      responses: {
        201: JourneySchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/journeys/:id',
      pathParams: IdParamSchema,
      responses: {
        200: JourneySchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/journeys/:id',
      pathParams: IdParamSchema,
      body: UpdateJourneyBodySchema,
      responses: {
        200: JourneySchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/journeys/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
  },
  versions: {
    list: {
      method: 'GET',
      path: '/api/v1/journeys/:id/versions',
      pathParams: IdParamSchema,
      responses: {
        200: z.array(JourneyVersionSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/journeys/:id/versions',
      pathParams: IdParamSchema,
      body: CreateVersionBodySchema,
      responses: {
        201: JourneyVersionSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    publish: {
      method: 'POST',
      path: '/api/v1/journeys/:id/publish',
      pathParams: IdParamSchema,
      body: z.object({ versionId: z.number().optional() }).optional(),
      responses: {
        200: JourneySchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
});
