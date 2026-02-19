import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoringService } from '../application/scoring-service.js';
import { LeadScore } from '@mauntic/scoring-domain';
import type { LeadScoreRepository } from '@mauntic/scoring-domain';
import type { DomainEventPublisher } from '../application/scoring-service.js';

const mockRepo: LeadScoreRepository = {
    findByContact: vi.fn(),
    findByOrganization: vi.fn(),
    findLeaderboard: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
};

const mockPublisher: DomainEventPublisher = {
    publish: vi.fn(),
};

describe('ScoringService', () => {
    let service: ScoringService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ScoringService(mockRepo, mockPublisher);
    });

    describe('calculateScore', () => {
        it('should create a new score if none exists', async () => {
            const orgId = crypto.randomUUID();
            const contactId = crypto.randomUUID();

            vi.mocked(mockRepo.findByContact).mockResolvedValue(null);

            const result = await service.calculateScore(orgId, contactId, {
                engagement: 10,
                demographic: 5
            });

            expect(result.isSuccess).toBe(true);
            const score = result.getValue();
            expect(score.totalScore).toBe(15);
            expect(score.grade).toBe('F'); // < 20

            expect(mockRepo.save).toHaveBeenCalled();
            expect(mockPublisher.publish).toHaveBeenCalled();
        });

        it('should update existing score', async () => {
            const orgId = crypto.randomUUID();
            const contactId = crypto.randomUUID();

            const existing = LeadScore.create({
                organizationId: orgId,
                contactId: contactId,
                totalScore: 50
            });
            // Clear initial events from creation
            existing.clearDomainEvents();

            vi.mocked(mockRepo.findByContact).mockResolvedValue(existing);

            const result = await service.calculateScore(orgId, contactId, {
                engagement: 10,  // +10
                demographic: 10, // +10
                intent: 10       // +10
            });

            expect(result.isSuccess).toBe(true);
            const score = result.getValue();
            // Logic in service replaces score components, doesn't add to previous total directly in our simple impl
            // It sets new Total = eng + dem + intent
            expect(score.totalScore).toBe(30);
            expect(score.grade).toBe('D');

            expect(mockRepo.save).toHaveBeenCalled();
            expect(mockPublisher.publish).toHaveBeenCalled();
        });

        it('should cap score at 100', async () => {
            const orgId = crypto.randomUUID();
            const contactId = crypto.randomUUID();
            vi.mocked(mockRepo.findByContact).mockResolvedValue(null);

            const result = await service.calculateScore(orgId, contactId, {
                engagement: 50,
                demographic: 50,
                intent: 50 // Sum = 150
            });

            expect(result.isSuccess).toBe(true);
            expect(result.getValue().totalScore).toBe(100);
            expect(result.getValue().grade).toBe('A');
        });
    });
});
