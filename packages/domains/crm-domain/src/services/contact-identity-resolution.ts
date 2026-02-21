type ContactIdentitySnapshot = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  customFields: Record<string, unknown>;
};

export type ExternalIdentity = {
  source: string;
  externalId: string;
};

export type ContactMergeUpdate = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  customFields: Record<string, unknown>;
};

const EXTERNAL_ID_PREFIX = '_ext_id_';

/**
 * Extracts external identities from customFields.
 * Convention: keys prefixed with `_ext_id_<source>` hold the external ID.
 */
export function extractExternalIdentities(
  customFields: Record<string, unknown>,
): ExternalIdentity[] {
  const identities: ExternalIdentity[] = [];
  for (const [key, value] of Object.entries(customFields)) {
    if (key.startsWith(EXTERNAL_ID_PREFIX) && typeof value === 'string') {
      identities.push({
        source: key.slice(EXTERNAL_ID_PREFIX.length),
        externalId: value,
      });
    }
  }
  return identities;
}

/**
 * Builds a merged contact update from primary and secondary snapshots.
 * Policy: primary wins for scalar fields; customFields are union-merged
 * with primary taking precedence on conflicts.
 */
export function buildMergedContactUpdate(
  primary: ContactIdentitySnapshot,
  secondary: ContactIdentitySnapshot,
): ContactMergeUpdate {
  return {
    email: primary.email ?? secondary.email,
    firstName: primary.firstName ?? secondary.firstName,
    lastName: primary.lastName ?? secondary.lastName,
    phone: primary.phone ?? secondary.phone,
    customFields: {
      ...secondary.customFields,
      ...primary.customFields,
    },
  };
}
