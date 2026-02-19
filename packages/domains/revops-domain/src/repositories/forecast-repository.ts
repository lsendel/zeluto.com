import type { Forecast } from '../entities/forecast.js';

export interface ForecastRepository {
  findByPeriod(orgId: string, period: string, repId?: string): Promise<Forecast | null>;
  findByOrganization(orgId: string, period: string): Promise<Forecast[]>;
  save(forecast: Forecast): Promise<void>;
}
