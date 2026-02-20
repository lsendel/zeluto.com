import type { TenantContext } from '@mauntic/domain-kernel';
import { Hono } from 'hono';
import { blockUser, unblockUser } from '../application/commands/block-user.js';
import {
  updateUser,
  updateUserRole,
} from '../application/commands/update-user.js';
import { getUser } from '../application/queries/get-user.js';
import { listUsers } from '../application/queries/list-users.js';
import type { DrizzleDb } from '../infrastructure/database.js';
import { serializeUser } from '../utils/serialize-user.js';

type Env = {
  Bindings: { DB: Hyperdrive };
  Variables: { tenant: TenantContext; db: DrizzleDb };
};

const userRoutes = new Hono<Env>();

// GET /api/v1/identity/users - List users in the organization
userRoutes.get('/api/v1/identity/users', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');

  const page = Number(c.req.query('page') || '1');
  const limit = Number(c.req.query('limit') || '20');
  const search = c.req.query('search');

  try {
    const result = await listUsers(db, {
      organizationId: tenant.organizationId,
      page,
      limit,
      search,
    });

    return c.json({
      data: result.data.map(serializeUser),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list users' },
      500,
    );
  }
});

// GET /api/v1/identity/users/:id - Get a specific user
userRoutes.get('/api/v1/identity/users/:id', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const userId = c.req.param('id');

  try {
    const user = await getUser(db, userId, tenant.organizationId);

    if (!user) {
      return c.json({ code: 'NOT_FOUND', message: 'User not found' }, 404);
    }

    return c.json(serializeUser(user));
  } catch (error) {
    console.error('Error getting user:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to get user' },
      500,
    );
  }
});

// PATCH /api/v1/identity/users/:id/profile - Update user profile
userRoutes.patch('/api/v1/identity/users/:id/profile', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const userId = c.req.param('id');

  // Only the user themselves or an admin/owner can update profiles
  if (
    tenant.userId !== userId &&
    tenant.userRole !== 'owner' &&
    tenant.userRole !== 'admin'
  ) {
    return c.json(
      { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      403,
    );
  }

  try {
    const body = await c.req.json();
    const updated = await updateUser(db, {
      userId,
      name: body.name,
      image: body.image,
    });

    return c.json(serializeUser(updated));
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'UserNotFoundError') {
      return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
    }
    console.error('Error updating user:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update user' },
      500,
    );
  }
});

// PATCH /api/v1/identity/users/:id/role - Update user role
userRoutes.patch('/api/v1/identity/users/:id/role', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const userId = c.req.param('id');

  // Only owner/admin can change user roles
  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners and admins can change user roles',
      },
      403,
    );
  }

  try {
    const body = await c.req.json();
    const updated = await updateUserRole(db, {
      userId,
      role: body.role,
    });

    return c.json(serializeUser(updated));
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'UserNotFoundError') {
      return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
    }
    console.error('Error updating user role:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update user role' },
      500,
    );
  }
});

// POST /api/v1/identity/users/:id/block - Block a user
userRoutes.post('/api/v1/identity/users/:id/block', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const userId = c.req.param('id');

  // Only owner/admin can block users
  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      { code: 'FORBIDDEN', message: 'Only owners and admins can block users' },
      403,
    );
  }

  try {
    const updated = await blockUser(db, userId, tenant.organizationId);
    return c.json(serializeUser(updated));
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'CannotBlockOwnerError') {
        return c.json({ code: 'FORBIDDEN', message: error.message }, 403);
      }
      if (
        error.name === 'UserNotFoundError' ||
        error.name === 'UserNotInOrgError'
      ) {
        return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
      }
    }
    console.error('Error blocking user:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to block user' },
      500,
    );
  }
});

// POST /api/v1/identity/users/:id/unblock - Unblock a user
userRoutes.post('/api/v1/identity/users/:id/unblock', async (c) => {
  const tenant = c.get('tenant');
  const db = c.get('db');
  const userId = c.req.param('id');

  // Only owner/admin can unblock users
  if (tenant.userRole !== 'owner' && tenant.userRole !== 'admin') {
    return c.json(
      {
        code: 'FORBIDDEN',
        message: 'Only owners and admins can unblock users',
      },
      403,
    );
  }

  try {
    const updated = await unblockUser(db, userId);
    return c.json(serializeUser(updated));
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'UserNotFoundError') {
      return c.json({ code: 'NOT_FOUND', message: error.message }, 404);
    }
    console.error('Error unblocking user:', error);
    return c.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to unblock user' },
      500,
    );
  }
});

export default userRoutes;
