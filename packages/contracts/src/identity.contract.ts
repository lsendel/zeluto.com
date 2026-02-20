import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import {
  ErrorSchema,
  PaginatedResponseSchema,
  PaginationQuerySchema,
} from './common';

const c = initContract();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean().nullable(),
  image: z.string().nullable(),
  role: z.enum(['admin', 'user']),
  isBlocked: z.boolean(),
  lastSignedIn: z.string().nullable(),
  loginMethod: z.enum(['email', 'google', 'github']).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable(),
  planId: z.string().uuid().nullable(),
  stripeCustomerId: z.string().nullable(),
  isBlocked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const OrgMemberSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  joinedAt: z.string(),
});

export const OrgInviteSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  token: z.string(),
  invitedBy: z.string().uuid(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const SessionSchema = z.object({
  user: UserSchema,
  organizationId: z.string().uuid().nullable(),
});

export const MeResponseSchema = z.object({
  user: UserSchema,
  activeOrganization: OrganizationSchema.nullable(),
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
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
});

const UpdateUserRoleBodySchema = z.object({
  role: z.enum(['admin', 'user']),
});

const AcceptInviteBodySchema = z.object({
  token: z.string(),
});

// ---------------------------------------------------------------------------
// Path-param schemas
// ---------------------------------------------------------------------------

const UuidParamSchema = z.object({
  id: z.string().uuid(),
});

const OrgMemberParamSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
});

const InviteParamSchema = z.object({
  orgId: z.string().uuid(),
  inviteId: z.string().uuid(),
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
    list: {
      method: 'GET',
      path: '/api/v1/users',
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(UserSchema),
        401: ErrorSchema,
        403: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/users/:id',
      pathParams: UuidParamSchema,
      responses: {
        200: UserSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    updateProfile: {
      method: 'PATCH',
      path: '/api/v1/users/:id',
      pathParams: UuidParamSchema,
      body: UpdateUserBodySchema,
      responses: {
        200: UserSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    updateRole: {
      method: 'PATCH',
      path: '/api/v1/users/:id/role',
      pathParams: UuidParamSchema,
      body: UpdateUserRoleBodySchema,
      responses: {
        200: UserSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    block: {
      method: 'POST',
      path: '/api/v1/users/:id/block',
      pathParams: UuidParamSchema,
      body: z.object({}).optional(),
      responses: {
        200: UserSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    unblock: {
      method: 'POST',
      path: '/api/v1/users/:id/unblock',
      pathParams: UuidParamSchema,
      body: z.object({}).optional(),
      responses: {
        200: UserSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  me: {
    get: {
      method: 'GET',
      path: '/api/v1/identity/me',
      responses: {
        200: MeResponseSchema,
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
        401: ErrorSchema,
      },
    },
    create: {
      method: 'POST',
      path: '/api/v1/organizations',
      body: CreateOrganizationBodySchema,
      responses: {
        201: OrganizationSchema,
        400: ErrorSchema,
        401: ErrorSchema,
      },
    },
    get: {
      method: 'GET',
      path: '/api/v1/organizations/:id',
      pathParams: UuidParamSchema,
      responses: {
        200: OrganizationSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    update: {
      method: 'PATCH',
      path: '/api/v1/organizations/:id',
      pathParams: UuidParamSchema,
      body: UpdateOrganizationBodySchema,
      responses: {
        200: OrganizationSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    delete: {
      method: 'DELETE',
      path: '/api/v1/organizations/:id',
      pathParams: UuidParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    switch: {
      method: 'POST',
      path: '/api/v1/identity/organizations/:id/switch',
      pathParams: UuidParamSchema,
      body: z.object({}).optional(),
      responses: {
        200: SessionSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  members: {
    list: {
      method: 'GET',
      path: '/api/v1/organizations/:orgId/members',
      pathParams: z.object({ orgId: z.string().uuid() }),
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(OrgMemberSchema),
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    changeRole: {
      method: 'PATCH',
      path: '/api/v1/organizations/:orgId/members/:userId',
      pathParams: OrgMemberParamSchema,
      body: UpdateMemberBodySchema,
      responses: {
        200: OrgMemberSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
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
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
  invites: {
    list: {
      method: 'GET',
      path: '/api/v1/organizations/:orgId/invites',
      pathParams: z.object({ orgId: z.string().uuid() }),
      query: PaginationQuerySchema,
      responses: {
        200: PaginatedResponseSchema(OrgInviteSchema),
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    invite: {
      method: 'POST',
      path: '/api/v1/organizations/:orgId/invites',
      pathParams: z.object({ orgId: z.string().uuid() }),
      body: InviteMemberBodySchema,
      responses: {
        201: OrgInviteSchema,
        400: ErrorSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    cancel: {
      method: 'DELETE',
      path: '/api/v1/organizations/:orgId/invites/:inviteId',
      pathParams: InviteParamSchema,
      body: z.any().optional(),
      responses: {
        200: z.object({ success: z.boolean() }),
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
    accept: {
      method: 'POST',
      path: '/api/v1/invites/accept',
      body: AcceptInviteBodySchema,
      responses: {
        200: z.object({
          success: z.boolean(),
          organizationId: z.string().uuid(),
        }),
        400: ErrorSchema,
        401: ErrorSchema,
        404: ErrorSchema,
      },
    },
    resend: {
      method: 'POST',
      path: '/api/v1/organizations/:orgId/invites/:inviteId/resend',
      pathParams: InviteParamSchema,
      body: z.object({}).optional(),
      responses: {
        200: OrgInviteSchema,
        401: ErrorSchema,
        403: ErrorSchema,
        404: ErrorSchema,
      },
    },
  },
});
