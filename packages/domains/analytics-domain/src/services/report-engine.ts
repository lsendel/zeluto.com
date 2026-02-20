import type { ReportType } from '../entities/report.js';

export interface ReportDateRange {
  startDate: Date;
  endDate: Date;
}

export interface ReportDataset {
  label: string;
  data: number[];
}

export interface ReportResult {
  labels: string[];
  datasets: ReportDataset[];
  summary: Record<string, number>;
}

export interface ReportDataSource {
  getContactGrowth(
    orgId: string,
    range: ReportDateRange,
  ): Promise<ReportResult>;
  getEmailPerformance(
    orgId: string,
    range: ReportDateRange,
  ): Promise<ReportResult>;
  getCampaignComparison(
    orgId: string,
    range: ReportDateRange,
    campaignIds?: string[],
  ): Promise<ReportResult>;
  getRevenue(orgId: string, range: ReportDateRange): Promise<ReportResult>;
}

export class ReportEngine {
  constructor(private dataSource: ReportDataSource) {}

  async generate(
    orgId: string,
    type: ReportType,
    config: Record<string, unknown>,
    dateRange?: ReportDateRange,
  ): Promise<ReportResult> {
    const range = dateRange ?? this.defaultDateRange();

    switch (type) {
      case 'contact_growth':
        return this.dataSource.getContactGrowth(orgId, range);
      case 'email_performance':
        return this.dataSource.getEmailPerformance(orgId, range);
      case 'campaign_comparison': {
        const campaignIds = config.campaignIds as string[] | undefined;
        return this.dataSource.getCampaignComparison(orgId, range, campaignIds);
      }
      case 'revenue':
        return this.dataSource.getRevenue(orgId, range);
      default:
        return { labels: [], datasets: [], summary: {} };
    }
  }

  private defaultDateRange(): ReportDateRange {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    return { startDate, endDate };
  }
}
