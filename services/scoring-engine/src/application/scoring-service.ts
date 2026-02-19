import { Result, type DomainEvent } from '@mauntic/domain-kernel';
import { LeadScore, type LeadScoreRepository } from '@mauntic/scoring-domain';

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
    ) { }

    async calculateScore(
        organizationId: string,
        contactId: string,
        context: ScoringContext,
    ): Promise<Result<LeadScore>> {
        try {
            let leadScore = await this.leadScoreRepo.findByContact(organizationId, contactId);

            if (!leadScore) {
                leadScore = LeadScore.create({
                    organizationId,
                    contactId,
                    totalScore: 0,
                });
            }

            // Simplified scoring logic - just summing up provided scores
            // In a real system, this would evaluate rules against contact data
            const newTotal = (context.engagement || 0) + (context.demographic || 0) + (context.intent || 0);

            leadScore.updateScore({
                totalScore: newTotal,
                engagementScore: context.engagement || 0,
                fitScore: context.demographic || 0,
                intentScore: context.intent || 0,
            });

            await this.leadScoreRepo.save(leadScore);

            const events = leadScore.pullDomainEvents();
            if (events.length > 0) {
                await this.eventPublisher.publish(events);
            }

            return Result.ok(leadScore);
        } catch (error: any) {
            // Log error (though service should ideally take a logger)
            return Result.fail(error.message || 'Failed to calculate score');
        }
    }
}
