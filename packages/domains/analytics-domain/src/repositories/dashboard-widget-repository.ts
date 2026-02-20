import type { DashboardWidget } from '../entities/dashboard-widget.js';

export interface DashboardWidgetRepository {
  save(widget: DashboardWidget): Promise<void>;
  findById(orgId: string, id: string): Promise<DashboardWidget | null>;
  findByDashboard(
    orgId: string,
    dashboardId: string,
  ): Promise<DashboardWidget[]>;
  findByOrganization(orgId: string): Promise<DashboardWidget[]>;
  update(widget: DashboardWidget): Promise<void>;
  delete(orgId: string, id: string): Promise<void>;
}
