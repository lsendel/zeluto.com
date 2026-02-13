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

export const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  image: z.string().nullable(),
  role: z.enum(['admin', 'user']),
  createdAt: z.string(),
});

export const OrganizationSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
  createdAt: z.string(),
});

export const OrgMemberSchema = z.object({
  userId: z.number(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member']),
  joinedAt: z.string(),
});

export const SessionSchema = z.object({
  user: UserSchema,
  organizationId: z.number().nullable(),
});

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

const SignupBodySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const UpdateUserBodySchema = z.object({
  name: z.string().min(1).optional(),
  image: z.string().nullable().optional(),
});

const CreateOrganizationBodySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
});

const UpdateOrganizationBodySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
});

const InviteMemberBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
});

const UpdateMemberBodySchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

// ---------------------------------------------------------------------------
// Path-param schemas
// ---------------------------------------------------------------------------

const OrgMemberParamSchema = z.object({
  orgId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const identityContract = c.router({
  auth: {
    signup: {
      method: 'POST',
      path: '/api/v1/auth/signup',
      body: SignupBodySchema,
      responses: {
        201: z.object({ user: UserSchema, token: z.string() }),
        400: ErrorSchema,
      },
    },
    login: {
      method: 'POST',
      path: '/api/v1/auth/login',
      body: LoginBodySchema,
      responses: {
        200: z.object({ user: UserSchema, token: z.string() }),
        401: ErrorSchema,
      },
    },
    logout: {
      method: 'POST',
      path: '/api/v1/auth/logout',
      body: z.object({}).optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    },
    session: {
      method: 'GET',
      path: '/api/v1/auth/session',
      responses: {
        200: SessionSchema,
        401: ErrorSchema,
      },
    },
  },
  users: {
    me: {
      method: 'GET',
      path: '/api/v1/users/me',
      responses: {
        200: UserSchema,
        401: ErrorSchema,
      },
    },
    updateMe: {
      method: 'PATCH',
      path: '/api/v1/users/me',
      body: UpdateUserBodySchema,
      responses: {
        200: UserSchema,
        401: ErrorSchema,
      },
    },
  },
  organizations: {
    list: {
      method: 'GET',
      path: '/api/v1/organizations',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(OrganizationSchema),
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/organizations',
      body: CreateOrganizationBodySchema,
      responses: {
        201: OrganizationSchema,
        400: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/organizations/:id',
      pathParams: IdParamSchema,
      responses: {
        200: OrganizationSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/organizations/:id',
      pathParams: IdParamSchema,
      body: UpdateOrganizationBodySchema,
      responses: {
        200: OrganizationSchema,
        400: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  members: {
    list: {
      method: 'GET',
      path: '/api/v1/organizations/:id/members',
      pathParams: IdParamSchema,
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(OrgMemberSchema),
      },
    },
    invite: {
      method: 'POST',
      path: '/api/v1/organizations/:id/members/invite',
      pathParams: IdParamSchema,
      body: InviteMemberBodySchema,
      responses: {
        201: z.object({ success: z.boolean(), inviteId: z.string() }),
        400: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/organizations/:orgId/members/:userId',
      pathParams: OrgMemberParamSchema,
      body: UpdateMemberBodySchema,
      responses: {
        200: OrgMemberSchema,
        404: ErrorSchema,
      },
    },
    remove: {
      method: 'DELETE',
      path: '/api/v1/organizations/:orgId/members/:userId',
      pathParams: OrgMemberParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: ErrorSchema,
      },
    },
  },
});
