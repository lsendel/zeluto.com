import { describe, expect, it } from 'vitest';
import {
  canWriteSensitiveCustomFields,
  collectSensitiveCustomFieldKeys,
  isSensitiveCustomFieldKey,
  redactSensitiveCustomFieldsForRole,
} from './field-access-control.js';

describe('isSensitiveCustomFieldKey', () => {
  it('detects exact sensitive keys', () => {
    expect(isSensitiveCustomFieldKey('ssn')).toBe(true);
    expect(isSensitiveCustomFieldKey('tax_id')).toBe(true);
    expect(isSensitiveCustomFieldKey('date_of_birth')).toBe(true);
    expect(isSensitiveCustomFieldKey('salary')).toBe(true);
    expect(isSensitiveCustomFieldKey('bank_account')).toBe(true);
  });

  it('detects prefixed sensitive keys', () => {
    expect(isSensitiveCustomFieldKey('_pii_national_id')).toBe(true);
    expect(isSensitiveCustomFieldKey('_financial_credit_score')).toBe(true);
    expect(isSensitiveCustomFieldKey('_health_condition')).toBe(true);
  });

  it('returns false for non-sensitive keys', () => {
    expect(isSensitiveCustomFieldKey('company_name')).toBe(false);
    expect(isSensitiveCustomFieldKey('lead_source')).toBe(false);
  });
});

describe('collectSensitiveCustomFieldKeys', () => {
  it('returns all sensitive keys from customFields', () => {
    const keys = collectSensitiveCustomFieldKeys({
      ssn: '123',
      company: 'Acme',
      _pii_passport: 'ABC',
    });
    expect(keys).toEqual(expect.arrayContaining(['ssn', '_pii_passport']));
    expect(keys).not.toContain('company');
  });

  it('returns empty array for null', () => {
    expect(collectSensitiveCustomFieldKeys(null)).toEqual([]);
  });
});

describe('canWriteSensitiveCustomFields', () => {
  it('allows owner and admin', () => {
    expect(canWriteSensitiveCustomFields('owner')).toBe(true);
    expect(canWriteSensitiveCustomFields('admin')).toBe(true);
  });

  it('denies member and viewer', () => {
    expect(canWriteSensitiveCustomFields('member')).toBe(false);
    expect(canWriteSensitiveCustomFields('viewer')).toBe(false);
  });
});

describe('redactSensitiveCustomFieldsForRole', () => {
  const fields = {
    ssn: '999-00-1234',
    company: 'Acme',
    _pii_national_id: 'ABC123',
    lead_source: 'web',
  };

  it('returns unredacted for owner', () => {
    const result = redactSensitiveCustomFieldsForRole(fields, 'owner');
    expect(result.ssn).toBe('999-00-1234');
    expect(result._pii_national_id).toBe('ABC123');
  });

  it('redacts sensitive fields for member', () => {
    const result = redactSensitiveCustomFieldsForRole(fields, 'member');
    expect(result.ssn).toBe('[REDACTED]');
    expect(result._pii_national_id).toBe('[REDACTED]');
    expect(result.company).toBe('Acme');
    expect(result.lead_source).toBe('web');
  });

  it('redacts sensitive fields for viewer', () => {
    const result = redactSensitiveCustomFieldsForRole(fields, 'viewer');
    expect(result.ssn).toBe('[REDACTED]');
    expect(result.company).toBe('Acme');
  });

  it('returns empty object for null', () => {
    expect(redactSensitiveCustomFieldsForRole(null, 'viewer')).toEqual({});
  });
});
