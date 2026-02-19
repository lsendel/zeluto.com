import type { Activity } from '../entities/activity.js';

export interface ActivityRepository {
  findById(orgId: string, id: string): Promise<Activity | null>;
  findByDeal(orgId: string, dealId: string): Promise<Activity[]>;
  findByContact(orgId: string, contactId: string): Promise<Activity[]>;
  findRecent(orgId: string, limit: number): Promise<Activity[]>;
  save(activity: Activity): Promise<void>;
}
