import type { DomainEvent } from '@mauntic/domain-kernel';

/**
 * Input that the journey domain understands for trigger evaluation.
 */
export interface JourneyTriggerInput {
  triggerType: 'event' | 'segment' | 'api' | 'scheduled';
  eventType?: string;
  contactId?: string;
  segmentId?: string;
  filters?: Record<string, unknown>;
}

/**
 * Anti-corruption layer: translates CRM domain events into
 * Journey domain language (JourneyTriggerInput).
 *
 * Returns null if the event is not relevant to the Journey context.
 */
export function translateCrmEvent(event: DomainEvent): JourneyTriggerInput | null {
  switch (event.type) {
    case 'crm.ContactCreated':
      return {
        triggerType: 'event',
        eventType: 'contact.created',
        contactId: String((event.data as Record<string, unknown>).contactId),
      };

    case 'crm.ContactUpdated':
      return {
        triggerType: 'event',
        eventType: 'contact.updated',
        contactId: String((event.data as Record<string, unknown>).contactId),
        filters: {
          fields: (event.data as Record<string, unknown>).fields,
        },
      };

    case 'crm.ContactTagged':
      return {
        triggerType: 'event',
        eventType: 'contact.tagged',
        contactId: String((event.data as Record<string, unknown>).contactId),
        filters: {
          tagId: (event.data as Record<string, unknown>).tagId,
        },
      };

    case 'crm.ContactUntagged':
      return {
        triggerType: 'event',
        eventType: 'contact.untagged',
        contactId: String((event.data as Record<string, unknown>).contactId),
        filters: {
          tagId: (event.data as Record<string, unknown>).tagId,
        },
      };

    case 'crm.SegmentRebuilt':
      return {
        triggerType: 'segment',
        segmentId: String((event.data as Record<string, unknown>).segmentId),
      };

    case 'content.FormSubmitted':
      return {
        triggerType: 'event',
        eventType: 'form.submitted',
        contactId: (event.data as Record<string, unknown>).contactId
          ? String((event.data as Record<string, unknown>).contactId)
          : undefined,
        filters: {
          formId: (event.data as Record<string, unknown>).formId,
        },
      };

    case 'content.PageVisited':
      return {
        triggerType: 'event',
        eventType: 'page.visited',
        contactId: (event.data as Record<string, unknown>).contactId
          ? String((event.data as Record<string, unknown>).contactId)
          : undefined,
        filters: {
          pageId: (event.data as Record<string, unknown>).pageId,
        },
      };

    case 'delivery.MessageOpened':
      return {
        triggerType: 'event',
        eventType: 'email.opened',
        contactId: String((event.data as Record<string, unknown>).contactId),
        filters: {
          deliveryJobId: (event.data as Record<string, unknown>).deliveryJobId,
        },
      };

    case 'delivery.MessageClicked':
      return {
        triggerType: 'event',
        eventType: 'email.clicked',
        contactId: String((event.data as Record<string, unknown>).contactId),
        filters: {
          url: (event.data as Record<string, unknown>).url,
          deliveryJobId: (event.data as Record<string, unknown>).deliveryJobId,
        },
      };

    default:
      return null;
  }
}
