import type {
  AggregatedMetric,
  MetricPeriod,
} from '../entities/aggregated-metric.js';

export interface AggregatedMetricQuery {
  metricType?: string;
  period?: MetricPeriod;
  startDate?: Date;
  endDate?: Date;
}

export interface AggregatedMetricRepository {
  save(metric: AggregatedMetric): Promise<void>;
  saveMany(metrics: AggregatedMetric[]): Promise<void>;
  findByOrganization(
    orgId: string,
    query: AggregatedMetricQuery,
  ): Promise<AggregatedMetric[]>;
  upsert(metric: AggregatedMetric): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
