import { describe, expect, it } from 'vitest';
import {
  applyContactConsentPreferencesUpdate,
  readContactConsentPreferences,
} from './contact-preferences.js';

describe('readContactConsentPreferences', () => {
  it('returns defaults when customFields is null', () => {
    const result = readContactConsentPreferences(null);
    expect(result.communicationPreferences.email).toBe(true);
    expect(result.communicationPreferences.sms).toBe(false);
    expect(result.communicationPreferences.push).toBe(false);
    expect(result.communicationPreferences.linkedin).toBe(false);
    expect(result.marketingOptIn).toBe(false);
  });

  it('reads stored preferences from customFields', () => {
    const result = readContactConsentPreferences({
      _consent_preferences: { email: false, sms: true, push: true, linkedin: false },
      _consent_marketing_opt_in: true,
    });
    expect(result.communicationPreferences.email).toBe(false);
    expect(result.communicationPreferences.sms).toBe(true);
    expect(result.marketingOptIn).toBe(true);
  });

  it('fills missing channels with defaults', () => {
    const result = readContactConsentPreferences({
      _consent_preferences: { email: false },
    });
    expect(result.communicationPreferences.email).toBe(false);
    expect(result.communicationPreferences.sms).toBe(false);
  });
});

describe('applyContactConsentPreferencesUpdate', () => {
  it('merges partial channel update into existing preferences', () => {
    const current = {
      _consent_preferences: { email: true, sms: false, push: false, linkedin: false },
    };
    const result = applyContactConsentPreferencesUpdate(current, {
      communicationPreferences: { sms: true },
    });

    const prefs = result._consent_preferences as Record<string, boolean>;
    expect(prefs.email).toBe(true);
    expect(prefs.sms).toBe(true);
  });

  it('updates marketing opt-in independently', () => {
    const result = applyContactConsentPreferencesUpdate(null, {
      marketingOptIn: true,
    });
    expect(result._consent_marketing_opt_in).toBe(true);
  });

  it('does not mutate original customFields', () => {
    const original = { someField: 'value' };
    const result = applyContactConsentPreferencesUpdate(original, {
      marketingOptIn: true,
    });
    expect(result).not.toBe(original);
    expect(original).not.toHaveProperty('_consent_marketing_opt_in');
  });
});
