export type ContactPreferenceChannel = 'email' | 'sms' | 'push' | 'linkedin';

export interface ContactCommunicationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  linkedin: boolean;
}

export interface ContactConsentPreferences {
  communicationPreferences: ContactCommunicationPreferences;
  marketingOptIn: boolean;
}

export interface ContactConsentPreferencesUpdate {
  communicationPreferences?: Partial<ContactCommunicationPreferences>;
  marketingOptIn?: boolean;
}

const PREF_KEY = '_consent_preferences';
const MARKETING_KEY = '_consent_marketing_opt_in';

const DEFAULT_PREFERENCES: ContactCommunicationPreferences = {
  email: true,
  sms: false,
  push: false,
  linkedin: false,
};

/**
 * Reads consent preferences from a contact's customFields.
 * Returns defaults when no preferences have been explicitly set.
 */
export function readContactConsentPreferences(
  customFields: Record<string, unknown> | null | undefined,
): ContactConsentPreferences {
  const fields = customFields ?? {};
  const stored = fields[PREF_KEY] as
    | Partial<ContactCommunicationPreferences>
    | undefined;

  return {
    communicationPreferences: {
      email: stored?.email ?? DEFAULT_PREFERENCES.email,
      sms: stored?.sms ?? DEFAULT_PREFERENCES.sms,
      push: stored?.push ?? DEFAULT_PREFERENCES.push,
      linkedin: stored?.linkedin ?? DEFAULT_PREFERENCES.linkedin,
    },
    marketingOptIn: fields[MARKETING_KEY] === true,
  };
}

/**
 * Produces an updated customFields object with the new preferences merged in.
 * Does not mutate the original.
 */
export function applyContactConsentPreferencesUpdate(
  currentCustomFields: Record<string, unknown> | null | undefined,
  update: ContactConsentPreferencesUpdate,
): Record<string, unknown> {
  const fields = { ...(currentCustomFields ?? {}) };
  const current = readContactConsentPreferences(fields);

  if (update.communicationPreferences) {
    fields[PREF_KEY] = {
      ...current.communicationPreferences,
      ...update.communicationPreferences,
    };
  }

  if (update.marketingOptIn !== undefined) {
    fields[MARKETING_KEY] = update.marketingOptIn;
  }

  return fields;
}
