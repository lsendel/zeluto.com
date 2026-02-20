import { Segment } from '@mauntic/crm-domain';
import { describe, expect, it } from 'vitest';

describe('Segment entity', () => {
  it('should reconstitute a Segment from DB-like props', () => {
    const segment = Segment.reconstitute({
      id: crypto.randomUUID(),
      organizationId: crypto.randomUUID(),
      name: 'Active Users',
      description: 'Users active in the last 30 days',
      type: 'dynamic',
      filterCriteria: {
        operator: 'and',
        conditions: [
          { field: 'status', operator: 'eq', value: 'active' },
        ],
      },
      contactCount: 42,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(segment.name).toBe('Active Users');
    expect(segment.type).toBe('dynamic');
    expect(segment.contactCount).toBe(42);
    expect(segment.description).toBe('Users active in the last 30 days');
  });

  it('should create a Segment with defaults', () => {
    const segment = Segment.create({
      organizationId: crypto.randomUUID(),
      name: 'New Segment',
      type: 'static',
    });

    expect(segment.name).toBe('New Segment');
    expect(segment.type).toBe('static');
    expect(segment.contactCount).toBe(0);
    expect(segment.description).toBeNull();
    expect(segment.filterCriteria).toBeNull();
  });

  it('should update segment name and filter criteria', () => {
    const segment = Segment.create({
      organizationId: crypto.randomUUID(),
      name: 'Original',
      type: 'dynamic',
    });

    segment.update({
      name: 'Updated',
      filterCriteria: { operator: 'or', conditions: [] },
    });

    expect(segment.name).toBe('Updated');
    expect(segment.filterCriteria).toEqual({
      operator: 'or',
      conditions: [],
    });
  });

  it('should enforce invariant: empty name on update', () => {
    const segment = Segment.create({
      organizationId: crypto.randomUUID(),
      name: 'Valid',
      type: 'dynamic',
    });

    expect(() => segment.update({ name: '' })).toThrow(
      'Segment name must not be empty',
    );
  });

  it('should update contact count', () => {
    const segment = Segment.create({
      organizationId: crypto.randomUUID(),
      name: 'Counted',
      type: 'static',
    });

    segment.updateContactCount(100);
    expect(segment.contactCount).toBe(100);
  });

  it('should enforce invariant: negative contact count', () => {
    const segment = Segment.create({
      organizationId: crypto.randomUUID(),
      name: 'Counted',
      type: 'static',
    });

    expect(() => segment.updateContactCount(-1)).toThrow(
      'Contact count cannot be negative',
    );
  });

  it('should produce a frozen props object via toProps()', () => {
    const segment = Segment.create({
      organizationId: crypto.randomUUID(),
      name: 'Frozen',
      type: 'static',
    });

    const props = segment.toProps();
    expect(props.name).toBe('Frozen');
    expect(Object.isFrozen(props)).toBe(true);
  });
});
