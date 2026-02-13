import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import {
  findPointRulesByEventType,
  createPointLogEntry,
} from '../infrastructure/repositories/point-rule-repository.js';
import { mapDomainEventToPointEvent } from '@mauntic/campaign-domain';

/**
 * Calculates and awards points to a contact based on a domain event.
 * Looks up active point rules for the organization and event type,
 * then creates point log entries for each matching rule.
 *
 * @returns The total points awarded, or 0 if no matching rules.
 */
export async function calculateAndAwardPoints(
  db: NeonHttpDatabase,
  orgId: string,
  contactId: string,
  domainEventType: string,
  metadata?: Record<string, unknown>,
): Promise<number> {
  // Map the domain event type to a point event type
  const pointEventType = mapDomainEventToPointEvent(domainEventType);
  if (!pointEventType) {
    return 0;
  }

  // Find active rules for this event type
  const rules = await findPointRulesByEventType(db, orgId, pointEventType);
  if (rules.length === 0) {
    return 0;
  }

  let totalPoints = 0;

  // Award points for each matching rule
  for (const rule of rules) {
    await createPointLogEntry(db, {
      organizationId: orgId,
      contactId,
      ruleId: rule.id,
      eventType: pointEventType,
      points: rule.points,
      metadata: metadata ?? null,
    });
    totalPoints += rule.points;
  }

  return totalPoints;
}
