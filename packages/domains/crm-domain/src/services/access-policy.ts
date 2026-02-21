import type { TenantContext } from '@mauntic/domain-kernel';

export type CrmAction =
  | 'contact:read'
  | 'contact:write'
  | 'contact:delete'
  | 'contact:merge'
  | 'contact:sensitive-write'
  | 'contact:preferences-write'
  | 'company:read'
  | 'company:write'
  | 'company:delete'
  | 'segment:read'
  | 'segment:write'
  | 'segment:delete'
  | 'tag:read'
  | 'tag:write'
  | 'tag:delete'
  | 'field:read'
  | 'field:write';

type UserRole = TenantContext['userRole'];

/**
 * Role → action permission matrix.
 * owner/admin: full access
 * member: read + write (no delete, no merge, no sensitive-write)
 * viewer: read only
 */
const ACTION_ROLES: Record<CrmAction, readonly UserRole[]> = {
  'contact:read': ['owner', 'admin', 'member', 'viewer'],
  'contact:write': ['owner', 'admin', 'member'],
  'contact:delete': ['owner', 'admin'],
  'contact:merge': ['owner', 'admin'],
  'contact:sensitive-write': ['owner', 'admin'],
  'contact:preferences-write': ['owner', 'admin', 'member'],
  'company:read': ['owner', 'admin', 'member', 'viewer'],
  'company:write': ['owner', 'admin', 'member'],
  'company:delete': ['owner', 'admin'],
  'segment:read': ['owner', 'admin', 'member', 'viewer'],
  'segment:write': ['owner', 'admin', 'member'],
  'segment:delete': ['owner', 'admin'],
  'tag:read': ['owner', 'admin', 'member', 'viewer'],
  'tag:write': ['owner', 'admin', 'member'],
  'tag:delete': ['owner', 'admin'],
  'field:read': ['owner', 'admin', 'member', 'viewer'],
  'field:write': ['owner', 'admin'],
};

export function canPerformCrmAction(
  role: UserRole,
  action: CrmAction,
): boolean {
  const allowed = ACTION_ROLES[action];
  return allowed?.includes(role) ?? false;
}

export function requiredRolesForCrmAction(
  action: CrmAction,
): readonly UserRole[] {
  return ACTION_ROLES[action] ?? [];
}
