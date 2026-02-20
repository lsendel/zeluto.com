import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ErrorSchema,
  IdParamSchema,
  PaginatedResponseSchema,
  PaginationQuerySchema,
} from './common';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const JourneyStepSchema = z.object({
  id: z.string().uuid(),
  journeyVersionId: z.string().uuid(),
  type: z.enum(['trigger', 'action', 'condition', 'delay', 'split']),
  config: z.record(z.string(), z.unknown()),
  positionX: z.number(),
  positionY: z.number(),
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
  id: z.string().uuid(),
  journeyId: z.number(),
  versionNumber: z.number(),
  definition: z.record(z.string(), z.unknown()),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const JourneyTriggerSchema = z.object({
  id: z.string().uuid(),
  journeyId: z.number(),
  type: z.enum(['event', 'segment', 'manual', 'scheduled']),
  config: z.record(z.string(), z.unknown()),
});

export const JourneyExecutionSchema = z.object({
  id: z.string().uuid(),
  journeyId: z.number(),
  contactId: z.number(),
  status: z.enum(['active', 'completed', 'failed', 'canceled']),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
});

export const StepExecutionSchema = z.object({
  id: z.string().uuid(),
  executionId: z.string().uuid(),
  stepId: z.string().uuid(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  error: z.string().nullable(),
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
  definition: z.record(z.string(), z.unknown()),
});

const CreateStepBodySchema = z.object({
  type: z.enum(['trigger', 'action', 'condition', 'delay', 'split']),
  config: z.record(z.string(), z.unknown()),
  positionX: z.number(),
  positionY: z.number(),
});

const UpdateStepBodySchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

const CreateTriggerBodySchema = z.object({
  type: z.enum(['event', 'segment', 'manual', 'scheduled']),
  config: z.record(z.string(), z.unknown()),
});

const UpdateTriggerBodySchema = z.object({
  config: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const journeyContract = c.router({
  journeys: {
    list: {
      method: 'GET',
      path: '/api/v1/journey/journeys',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(JourneySchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/journey/journeys',
      body: CreateJourneyBodySchema,
      responses: {
        201: JourneySchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/journey/journeys/:id',
      pathParams: IdParamSchema,
      responses: {
        200: JourneySchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/journey/journeys/:id',
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
      path: '/api/v1/journey/journeys/:id',
      pathParams: IdParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
    publish: {
      method: 'POST',
      path: '/api/v1/journey/journeys/:id/publish',
      pathParams: IdParamSchema,
      body: z.object({ versionId: z.string().uuid().optional() }).optional(),
      responses: {
        200: JourneySchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    clone: {
      method: 'POST',
      path: '/api/v1/journey/journeys/:id/clone',
      pathParams: IdParamSchema,
      body: z.object({ name: z.string().min(1) }),
      responses: {
        201: JourneySchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    analytics: {
      method: 'GET',
      path: '/api/v1/journey/journeys/:id/analytics',
      pathParams: IdParamSchema,
      query: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }),
      responses: {
        200: z.object({
          totalExecutions: z.number(),
          completedExecutions: z.number(),
          failedExecutions: z.number(),
          activeExecutions: z.number(),
          conversionRate: z.number(),
          stepAnalytics: z.array(
            z.object({
              stepId: z.string().uuid(),
              stepType: z.string(),
              entrances: z.number(),
              exits: z.number(),
              completions: z.number(),
              failures: z.number(),
              dropOffRate: z.number(),
            }),
          ),
        }),
        404: ErrorSchema,
      },
    },
  },
  versions: {
    list: {
      method: 'GET',
      path: '/api/v1/journey/journeys/:id/versions',
      pathParams: IdParamSchema,
      responses: {
        200: z.array(JourneyVersionSchema),
        404: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/journey/journeys/:journeyId/versions/:versionId',
      pathParams: z.object({
        journeyId: z.coerce.number().int().positive(),
        versionId: z.string().uuid(),
      }),
      responses: {
        200: JourneyVersionSchema,
        404: ErrorSchema,
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/journey/journeys/:id/versions',
      pathParams: IdParamSchema,
      body: CreateVersionBodySchema,
      responses: {
        201: JourneyVersionSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  steps: {
    list: {
      method: 'GET',
      path: '/api/v1/journey/versions/:versionId/steps',
      pathParams: z.object({ versionId: z.string().uuid() }),
      responses: {
        200: z.array(JourneyStepSchema),
        404: ErrorSchema,
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/journey/versions/:versionId/steps',
      pathParams: z.object({ versionId: z.string().uuid() }),
      body: CreateStepBodySchema,
      responses: {
        201: JourneyStepSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/journey/steps/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: JourneyStepSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/journey/steps/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: UpdateStepBodySchema,
      responses: {
        200: JourneyStepSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/journey/steps/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
  },
  triggers: {
    list: {
      method: 'GET',
      path: '/api/v1/journey/journeys/:journeyId/triggers',
      pathParams: z.object({ journeyId: z.coerce.number().int().positive() }),
      responses: {
        200: z.array(JourneyTriggerSchema),
        404: ErrorSchema,
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/journey/journeys/:journeyId/triggers',
      pathParams: z.object({ journeyId: z.coerce.number().int().positive() }),
      body: CreateTriggerBodySchema,
      responses: {
        201: JourneyTriggerSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/journey/triggers/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: JourneyTriggerSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/journey/triggers/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: UpdateTriggerBodySchema,
      responses: {
        200: JourneyTriggerSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/journey/triggers/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
  },
  executions: {
    list: {
      method: 'GET',
      path: '/api/v1/journey/journeys/:journeyId/executions',
      pathParams: z.object({ journeyId: z.coerce.number().int().positive() }),
      query: PaginationQuerySchema.extend({
        status: z
          .enum(['active', 'completed', 'failed', 'canceled'])
          .optional(),
        contactId: z.coerce.number().optional(),
      }),
      responses: {
        200: PaginatedResponseSchema(JourneyExecutionSchema),
        404: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/journey/executions/:id',
      pathParams: z.object({ id: z.string().uuid() }),
      responses: {
        200: JourneyExecutionSchema.extend({
          steps: z.array(StepExecutionSchema),
        }),
        404: ErrorSchema,
      },
    },
    cancel: {
      method: 'POST',
      path: '/api/v1/journey/executions/:id/cancel',
      pathParams: z.object({ id: z.string().uuid() }),
      body: z.object({ reason: z.string().optional() }).optional(),
      responses: {
        200: JourneyExecutionSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
});
