import { describe, expect, it } from 'vitest';
import {
  buildMergedContactUpdate,
  extractExternalIdentities,
} from './contact-identity-resolution.js';

describe('extractExternalIdentities', () => {
  it('extracts identities from prefixed custom fields', () => {
    const ids = extractExternalIdentities({
      _ext_id_salesforce: 'sf-001',
      _ext_id_hubspot: 'hs-002',
      normalField: 'value',
    });
    expect(ids).toEqual([
      { source: 'salesforce', externalId: 'sf-001' },
      { source: 'hubspot', externalId: 'hs-002' },
    ]);
  });

  it('returns empty array when no external IDs exist', () => {
    const ids = extractExternalIdentities({ name: 'test' });
    expect(ids).toEqual([]);
  });

  it('ignores non-string external ID values', () => {
    const ids = extractExternalIdentities({
      _ext_id_broken: 123,
      _ext_id_valid: 'abc',
    });
    expect(ids).toEqual([{ source: 'valid', externalId: 'abc' }]);
  });
});

describe('buildMergedContactUpdate', () => {
  it('primary wins for scalar fields when both have values', () => {
    const result = buildMergedContactUpdate(
      {
        email: 'primary@test.com',
        firstName: 'Alice',
        lastName: null,
        phone: '+1111',
        customFields: { a: 1 },
      },
      {
        email: 'secondary@test.com',
        firstName: 'Bob',
        lastName: 'Smith',
        phone: '+2222',
        customFields: { b: 2 },
      },
    );
    expect(result.email).toBe('primary@test.com');
    expect(result.firstName).toBe('Alice');
    expect(result.phone).toBe('+1111');
  });

  it('falls back to secondary for null primary fields', () => {
    const result = buildMergedContactUpdate(
      {
        email: null,
        firstName: null,
        lastName: null,
        phone: null,
        customFields: {},
      },
      {
        email: 'secondary@test.com',
        firstName: 'Bob',
        lastName: 'Smith',
        phone: '+2222',
        customFields: {},
      },
    );
    expect(result.email).toBe('secondary@test.com');
    expect(result.firstName).toBe('Bob');
    expect(result.lastName).toBe('Smith');
  });

  it('merges customFields with primary winning conflicts', () => {
    const result = buildMergedContactUpdate(
      {
        email: null,
        firstName: null,
        lastName: null,
        phone: null,
        customFields: { shared: 'primary', onlyPrimary: true },
      },
      {
        email: null,
        firstName: null,
        lastName: null,
        phone: null,
        customFields: { shared: 'secondary', onlySecondary: true },
      },
    );
    expect(result.customFields.shared).toBe('primary');
    expect(result.customFields.onlyPrimary).toBe(true);
    expect(result.customFields.onlySecondary).toBe(true);
  });
});
