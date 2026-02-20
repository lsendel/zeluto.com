import { type DomainEvent, Result, type OrganizationId, type ContactId } from '@mauntic/domain-kernel';
import type { LeadScoreRepository } from '@mauntic/scoring-domain';
import { LeadScore } from '@mauntic/scoring-domain';

export interface DomainEventPublisher {
  publish(events: DomainEvent[]): Promise<void>;
}

export type ScoringContext = {
  engagement?: number;
  demographic?: number;
  intent?: number;
};

export class ScoringService {
  constructor(
    private readonly leadScoreRepo: LeadScoreRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async calculateScore(
    organizationId: OrganizationId,
    contactId: ContactId,
    context: ScoringContext,
  ): Promise<Result<LeadScore>> {
    try {
      let leadScore = await this.leadScoreRepo.findByContact(
        organizationId,
        contactId,
      );

      if (!leadScore) {
        leadScore = LeadScore.create({
          organizationId,
          contactId,
          totalScore: 0,
        });
      }

      const newTotal =
        (context.engagement ?? 0) +
        (context.demographic ?? 0) +
        (context.intent ?? 0);

      leadScore.updateScore({
        totalScore: newTotal,
        engagementScore: context.engagement ?? 0,
        fitScore: context.demographic ?? 0,
        intentScore: context.intent ?? 0,
      });

      await this.leadScoreRepo.save(leadScore);

      const events = leadScore.pullDomainEvents();
      if (events.length > 0) {
        await this.eventPublisher.publish(events);
      }

      return Result.ok(leadScore);
    } catch (error: any) {
      return Result.fail(error?.message ?? 'Failed to calculate score');
    }
  }
}
