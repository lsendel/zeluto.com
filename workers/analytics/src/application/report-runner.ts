import { ReportEngine, type ReportType } from '@mauntic/analytics-domain';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { DrizzleReportDataSource } from './report-data-source.js';

const DEFAULT_REPORT_TYPE: ReportType = 'contact_growth';

export interface RunnableReport {
  id: string;
  name: string;
  steps: unknown;
}

export async function runTypedReport(
  db: NeonHttpDatabase,
  organizationId: string,
  report: RunnableReport,
  input?: { startDate?: string; endDate?: string },
) {
  const config = toConfig(report.steps);
  const type = resolveReportType(config);
  const range = parseDateRange(input?.startDate, input?.endDate);

  const engine = new ReportEngine(new DrizzleReportDataSource(db));
  const data = await engine.generate(organizationId, type, config, range);

  return {
    reportId: report.id,
    generatedAt: new Date().toISOString(),
    data: {
      name: report.name,
      type,
      config,
      dateRange: {
        startDate: range?.startDate.toISOString(),
        endDate: range?.endDate.toISOString(),
      },
      labels: data.labels,
      datasets: data.datasets,
      summary: data.summary,
    },
  };
}

function toConfig(steps: unknown): Record<string, unknown> {
  if (steps && typeof steps === 'object' && !Array.isArray(steps)) {
    return steps as Record<string, unknown>;
  }
  return {};
}

function resolveReportType(config: Record<string, unknown>): ReportType {
  const candidate = config.type;
  if (
    candidate === 'contact_growth' ||
    candidate === 'email_performance' ||
    candidate === 'campaign_comparison' ||
    candidate === 'revenue'
  ) {
    return candidate;
  }
  return DEFAULT_REPORT_TYPE;
}

function parseDateRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return undefined;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return undefined;
  }
  if (start > end) {
    return undefined;
  }

  return { startDate: start, endDate: end };
}
