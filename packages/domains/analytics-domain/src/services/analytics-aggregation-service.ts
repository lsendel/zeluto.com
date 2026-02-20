import { Result } from '@mauntic/domain-kernel';

export interface HourlyAggregationResult {
  aggregatedGroups: number;
  timestamp: Date;
}

export interface DailyReportResult {
  campaignsProcessed: number;
  date: string;
}

export interface AnalyticsAggregationRepository {
  aggregateHourlyEvents(since: Date): Promise<HourlyAggregationResult>;
  generateDailyCampaignStats(day: Date): Promise<DailyReportResult>;
  generateMonthlyUsage(month: Date): Promise<number>;
  generateScoreDistribution(date: string): Promise<number>;
  generateEnrichmentMetrics(date: string): Promise<number>;
  resetDailyWarmup(): Promise<number>;
}

/**
 * AnalyticsService orchestrates background aggregation jobs for analytics dashboards.
 * The repository handles the actual persistence logic so we can swap implementations
 * between Workers (Neon) and the legacy Fly service.
 */
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsAggregationRepository) {}

  async runHourlyAggregation(): Promise<
    Result<HourlyAggregationResult, string>
  > {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await this.repo.aggregateHourlyEvents(oneHourAgo);
      return Result.ok<HourlyAggregationResult>(result);
    } catch (error: any) {
      return Result.fail<HourlyAggregationResult, string>(
        error.message ?? 'aggregation_failed',
      );
    }
  }

  async runDailyReports(): Promise<Result<DailyReportResult, string>> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const result = await this.repo.generateDailyCampaignStats(yesterday);
      return Result.ok<DailyReportResult>(result);
    } catch (error: any) {
      return Result.fail<DailyReportResult, string>(
        error.message ?? 'daily_reports_failed',
      );
    }
  }

  async runMonthlyUsage(): Promise<Result<number, string>> {
    try {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const result = await this.repo.generateMonthlyUsage(lastMonth);
      return Result.ok<number>(result);
    } catch (error: any) {
      return Result.fail<number, string>(
        error.message ?? 'monthly_usage_failed',
      );
    }
  }

  async runScoreDistribution(): Promise<Result<number, string>> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await this.repo.generateScoreDistribution(today);
      return Result.ok<number>(result);
    } catch (error: any) {
      return Result.fail<number, string>(
        error.message ?? 'score_distribution_failed',
      );
    }
  }

  async runEnrichmentMetrics(): Promise<Result<number, string>> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      const result = await this.repo.generateEnrichmentMetrics(dateStr);
      return Result.ok<number>(result);
    } catch (error: any) {
      return Result.fail<number, string>(
        error.message ?? 'enrichment_metrics_failed',
      );
    }
  }

  async runWarmupReset(): Promise<Result<number, string>> {
    try {
      const result = await this.repo.resetDailyWarmup();
      return Result.ok<number>(result);
    } catch (error: any) {
      return Result.fail<number, string>(
        error.message ?? 'warmup_reset_failed',
      );
    }
  }
}
