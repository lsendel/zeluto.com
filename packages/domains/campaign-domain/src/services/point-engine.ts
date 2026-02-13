import type { PointRule } from '../entities/point-rule.js';
import type { PointEventType } from '../entities/point-rule.js';

/**
 * Point calculation result after evaluating all active rules for an event.
 */
export interface PointCalculation {
  contactId: string;
  eventType: PointEventType;
  totalPoints: number;
  appliedRules: Array<{
    ruleId: string;
    points: number;
    description: string | null;
  }>;
}

/**
 * Calculates the total points to award for a given event type
 * based on the organization's configured point rules.
 */
export function calculatePoints(
  rules: PointRule[],
  contactId: string,
  eventType: PointEventType,
): PointCalculation {
  const activeRules = rules.filter((r) => r.isActive && r.eventType === eventType);

  const appliedRules = activeRules.map((rule) => ({
    ruleId: rule.id,
    points: rule.points,
    description: rule.description,
  }));

  const totalPoints = appliedRules.reduce((sum, r) => sum + r.points, 0);

  return {
    contactId,
    eventType,
    totalPoints,
    appliedRules,
  };
}

/**
 * Maps domain event types to point event types.
 * Returns null if the domain event type has no corresponding point rule mapping.
 */
export function mapDomainEventToPointEvent(
  domainEventType: string,
): PointEventType | null {
  switch (domainEventType) {
    case 'delivery.MessageOpened':
      return 'email.opened';
    case 'delivery.MessageClicked':
      return 'email.clicked';
    case 'content.FormSubmitted':
      return 'form.submitted';
    case 'content.PageVisited':
      return 'page.visited';
    case 'crm.ContactTagged':
      return 'contact.tagged';
    default:
      return null;
  }
}
