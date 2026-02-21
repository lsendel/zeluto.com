import type { TenantContext } from '@mauntic/domain-kernel';

type UserRole = TenantContext['userRole'];

/**
 * Sensitive field key prefixes.
 * Fields starting with these prefixes are considered sensitive
 * and require elevated permissions to write or view.
 */
const SENSITIVE_PREFIXES = ['_pii_', '_financial_', '_health_'];
const SENSITIVE_EXACT_KEYS = new Set([
  'ssn',
  'tax_id',
  'date_of_birth',
  'salary',
  'bank_account',
]);

export function isSensitiveCustomFieldKey(key: string): boolean {
  if (SENSITIVE_EXACT_KEYS.has(key)) return true;
  return SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function collectSensitiveCustomFieldKeys(
  customFields: Record<string, unknown> | null | undefined,
): string[] {
  if (!customFields) return [];
  return Object.keys(customFields).filter(isSensitiveCustomFieldKey);
}

export function canWriteSensitiveCustomFields(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Returns a copy of customFields with sensitive values replaced by '[REDACTED]'.
 * Only owner and admin see unredacted values.
 */
export function redactSensitiveCustomFieldsForRole(
  customFields: Record<string, unknown> | null | undefined,
  role: UserRole,
): Record<string, unknown> {
  if (!customFields) return {};
  if (role === 'owner' || role === 'admin') return { ...customFields };

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(customFields)) {
    redacted[key] = isSensitiveCustomFieldKey(key) ? '[REDACTED]' : value;
  }
  return redacted;
}
