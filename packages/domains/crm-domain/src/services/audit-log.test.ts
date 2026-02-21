import { describe, expect, it } from 'vitest';
import { computeChangeDelta, createAuditEntry } from './audit-log.js';

describe('createAuditEntry', () => {
  it('creates a valid audit entry with all fields', () => {
    const entry = createAuditEntry({
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'contact.created',
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      entityType: 'contact',
      entityId: '550e8400-e29b-41d4-a716-446655440002',
      before: null,
      after: { email: 'test@example.com', firstName: 'Alice' },
    });

    expect(entry.id).toBeDefined();
    expect(entry.action).toBe('contact.created');
    expect(entry.before).toBeNull();
    expect(entry.after).toEqual({ email: 'test@example.com', firstName: 'Alice' });
    expect(entry.timestamp).toBeInstanceOf(Date);
  });

  it('defaults before/after to null when omitted', () => {
    const entry = createAuditEntry({
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'contact.deleted',
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      entityType: 'contact',
      entityId: '550e8400-e29b-41d4-a716-446655440002',
    });

    expect(entry.before).toBeNull();
    expect(entry.after).toBeNull();
  });

  it('includes optional metadata', () => {
    const entry = createAuditEntry({
      organizationId: '550e8400-e29b-41d4-a716-446655440000',
      action: 'role.changed',
      actorId: '550e8400-e29b-41d4-a716-446655440001',
      entityType: 'member',
      entityId: '550e8400-e29b-41d4-a716-446655440002',
      metadata: { ip: '192.168.1.1', userAgent: 'Chrome' },
    });

    expect(entry.metadata).toEqual({ ip: '192.168.1.1', userAgent: 'Chrome' });
  });
});

describe('computeChangeDelta', () => {
  it('returns changed fields only', () => {
    const delta = computeChangeDelta(
      { email: 'old@test.com', name: 'Same' },
      { email: 'new@test.com', name: 'Same' },
    );
    expect(delta).toEqual({
      email: { from: 'old@test.com', to: 'new@test.com' },
    });
  });

  it('detects added fields', () => {
    const delta = computeChangeDelta(
      { email: 'test@test.com' },
      { email: 'test@test.com', phone: '+1234' },
    );
    expect(delta).toEqual({
      phone: { from: null, to: '+1234' },
    });
  });

  it('detects removed fields', () => {
    const delta = computeChangeDelta(
      { email: 'test@test.com', phone: '+1234' },
      { email: 'test@test.com' },
    );
    expect(delta).toEqual({
      phone: { from: '+1234', to: null },
    });
  });

  it('returns empty delta when nothing changed', () => {
    const delta = computeChangeDelta(
      { a: 1, b: 'x' },
      { a: 1, b: 'x' },
    );
    expect(delta).toEqual({});
  });

  it('handles null before (creation)', () => {
    const delta = computeChangeDelta(null, { email: 'new@test.com' });
    expect(delta).toEqual({
      email: { from: null, to: 'new@test.com' },
    });
  });

  it('handles null after (deletion)', () => {
    const delta = computeChangeDelta({ email: 'old@test.com' }, null);
    expect(delta).toEqual({
      email: { from: 'old@test.com', to: null },
    });
  });
});
