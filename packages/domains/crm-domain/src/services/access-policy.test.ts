import { describe, expect, it } from 'vitest';
import {
  canPerformCrmAction,
  requiredRolesForCrmAction,
} from './access-policy.js';

describe('canPerformCrmAction', () => {
  it('owner can perform all actions', () => {
    expect(canPerformCrmAction('owner', 'contact:read')).toBe(true);
    expect(canPerformCrmAction('owner', 'contact:delete')).toBe(true);
    expect(canPerformCrmAction('owner', 'contact:merge')).toBe(true);
    expect(canPerformCrmAction('owner', 'contact:sensitive-write')).toBe(true);
    expect(canPerformCrmAction('owner', 'field:write')).toBe(true);
  });

  it('admin can perform all actions', () => {
    expect(canPerformCrmAction('admin', 'contact:delete')).toBe(true);
    expect(canPerformCrmAction('admin', 'contact:merge')).toBe(true);
    expect(canPerformCrmAction('admin', 'field:write')).toBe(true);
  });

  it('member can read and write but not delete or merge', () => {
    expect(canPerformCrmAction('member', 'contact:read')).toBe(true);
    expect(canPerformCrmAction('member', 'contact:write')).toBe(true);
    expect(canPerformCrmAction('member', 'contact:delete')).toBe(false);
    expect(canPerformCrmAction('member', 'contact:merge')).toBe(false);
    expect(canPerformCrmAction('member', 'contact:sensitive-write')).toBe(
      false,
    );
  });

  it('viewer can only read', () => {
    expect(canPerformCrmAction('viewer', 'contact:read')).toBe(true);
    expect(canPerformCrmAction('viewer', 'company:read')).toBe(true);
    expect(canPerformCrmAction('viewer', 'contact:write')).toBe(false);
    expect(canPerformCrmAction('viewer', 'segment:write')).toBe(false);
  });

  it('member can write preferences but not sensitive fields', () => {
    expect(canPerformCrmAction('member', 'contact:preferences-write')).toBe(
      true,
    );
    expect(canPerformCrmAction('member', 'contact:sensitive-write')).toBe(
      false,
    );
  });
});

describe('requiredRolesForCrmAction', () => {
  it('returns all four roles for read actions', () => {
    expect(requiredRolesForCrmAction('contact:read')).toEqual([
      'owner',
      'admin',
      'member',
      'viewer',
    ]);
  });

  it('returns only owner and admin for delete', () => {
    expect(requiredRolesForCrmAction('contact:delete')).toEqual([
      'owner',
      'admin',
    ]);
  });
});
