export {
  canPerformCrmAction,
  type CrmAction,
  requiredRolesForCrmAction,
} from './access-policy.js';
export {
  type AuditAction,
  AuditActionSchema,
  type AuditEntry,
  AuditEntrySchema,
  computeChangeDelta,
  createAuditEntry,
} from './audit-log.js';
export {
  buildMergedContactUpdate,
  type ContactMergeUpdate,
  type ExternalIdentity,
  extractExternalIdentities,
} from './contact-identity-resolution.js';
export {
  applyContactConsentPreferencesUpdate,
  type ContactCommunicationPreferences,
  type ContactConsentPreferences,
  type ContactConsentPreferencesUpdate,
  type ContactPreferenceChannel,
  readContactConsentPreferences,
} from './contact-preferences.js';
export {
  canWriteSensitiveCustomFields,
  collectSensitiveCustomFieldKeys,
  isSensitiveCustomFieldKey,
  redactSensitiveCustomFieldsForRole,
} from './field-access-control.js';
export {
  buildDrizzleWhere,
  evaluateFilter,
  type FilterCondition,
  FilterConditionSchema,
  type FilterCriteria,
  FilterCriteriaSchema,
  type FilterOperator,
  FilterOperatorSchema,
} from './segment-filter-engine.js';
