/**
 * Cross-context event routing for Revenue Operations events.
 *
 * Event flow:
 * DealStageChangedEvent → evaluates RevOps workflows
 * DealCreatedEvent → triggers lead routing
 */

export interface DealStageChangedPayload {
  organizationId: string;
  dealId: string;
  stage: string;
  previousStage?: string;
  contactId?: string;
}

export function routeDealStageChangedEvent(payload: DealStageChangedPayload) {
  return [
    {
      targetQueue: 'revops:workflow',
      data: {
        organizationId: payload.organizationId,
        trigger: 'deal_stage_changed',
        context: {
          dealId: payload.dealId,
          stage: payload.stage,
          previousStage: payload.previousStage,
          contactId: payload.contactId,
        },
      },
    },
  ];
}

export interface DealCreatedPayload {
  organizationId: string;
  dealId: string;
  contactId: string;
}

export function routeDealCreatedEvent(payload: DealCreatedPayload) {
  return [
    {
      targetQueue: 'revops:routing',
      data: {
        organizationId: payload.organizationId,
        contactId: payload.contactId,
        dealId: payload.dealId,
      },
    },
    {
      targetQueue: 'revops:workflow',
      data: {
        organizationId: payload.organizationId,
        trigger: 'deal_created',
        context: {
          dealId: payload.dealId,
          contactId: payload.contactId,
        },
      },
    },
  ];
}
