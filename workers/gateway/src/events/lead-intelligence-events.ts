/**
 * Cross-context event routing for Lead Intelligence events.
 *
 * Event flow:
 * LeadEnrichedEvent → triggers scoring recalculation
 */
export interface LeadEnrichedPayload {
  organizationId: string;
  contactId: string;
  fieldsEnriched: string[];
}

export function routeLeadEnrichedEvent(payload: LeadEnrichedPayload) {
  return {
    targetQueue: 'scoring:recalculate',
    data: {
      organizationId: payload.organizationId,
      contactId: payload.contactId,
      reason: 'enrichment_completed',
      fieldsEnriched: payload.fieldsEnriched,
    },
  };
}
