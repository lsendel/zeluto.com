import { describe, it, expect, vi } from 'vitest';
import { AnalyticsService } from '../application/analytics-service';
import { Result } from '@mauntic/domain-kernel';

describe('AnalyticsService', () => {
    const mockRepo = {
        aggregateHourlyEvents: vi.fn(),
        generateDailyCampaignStats: vi.fn(),
        generateMonthlyUsage: vi.fn(),
        generateScoreDistribution: vi.fn(),
        generateEnrichmentMetrics: vi.fn(),
        resetDailyWarmup: vi.fn(),
    };

    const service = new AnalyticsService(mockRepo);

    it('should aggregate hourly events successfully', async () => {
        const expected = { aggregatedGroups: 10, timestamp: new Date() };
        mockRepo.aggregateHourlyEvents.mockResolvedValue(expected);

        const result = await service.runHourlyAggregation();

        expect(result.isSuccess).toBe(true);
        expect(result.getValue()).toEqual(expected);
        expect(mockRepo.aggregateHourlyEvents).toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
        mockRepo.aggregateHourlyEvents.mockRejectedValue(new Error('DB Error'));

        const result = await service.runHourlyAggregation();

        expect(result.isFailure).toBe(true);
        expect(result.getError()).toContain('DB Error');
    });

    it('should generate daily reports successfully', async () => {
        const expected = { campaignsProcessed: 5, date: '2023-10-26' };
        mockRepo.generateDailyCampaignStats.mockResolvedValue(expected);

        const result = await service.runDailyReports();

        expect(result.isSuccess).toBe(true);
        expect(result.getValue()).toEqual(expected);
        expect(mockRepo.generateDailyCampaignStats).toHaveBeenCalled();
    });

    it('should reset warmup counters', async () => {
        mockRepo.resetDailyWarmup.mockResolvedValue(5);

        const result = await service.runWarmupReset();

        expect(result.isSuccess).toBe(true);
        expect(result.getValue()).toBe(5);
    });
});
