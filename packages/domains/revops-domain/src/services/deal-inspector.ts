import type { ActivityProps } from '../entities/activity.js';
import type { DealProps } from '../entities/deal.js';

export interface DealHealthReport {
  dealId: string;
  riskLevel: 'healthy' | 'at_risk' | 'critical';
  flags: string[];
  recommendations: string[];
  score: number; // 0-100
}

// Thresholds for risk assessment
const INACTIVITY_DAYS_WARNING = 7;
const INACTIVITY_DAYS_CRITICAL = 14;
const STAGE_VELOCITY_THRESHOLD_DAYS = 21;

export class DealInspector {
  inspect(deal: DealProps, activities: ActivityProps[]): DealHealthReport {
    const flags: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check for closed deals
    if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
      return {
        dealId: deal.id,
        riskLevel: 'healthy',
        flags: [],
        recommendations: [],
        score: 100,
      };
    }

    // Check activity recency
    const now = Date.now();
    const lastActivity =
      activities.length > 0
        ? Math.max(...activities.map((a) => new Date(a.createdAt).getTime()))
        : new Date(deal.createdAt).getTime();
    const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);

    if (daysSinceActivity >= INACTIVITY_DAYS_CRITICAL) {
      flags.push(
        `No activity in ${Math.floor(daysSinceActivity)} days (critical)`,
      );
      recommendations.push('Schedule immediate follow-up');
      score -= 40;
    } else if (daysSinceActivity >= INACTIVITY_DAYS_WARNING) {
      flags.push(`No activity in ${Math.floor(daysSinceActivity)} days`);
      recommendations.push('Schedule follow-up activity');
      score -= 20;
    }

    // Check stage velocity
    const daysInStage =
      (now - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysInStage >= STAGE_VELOCITY_THRESHOLD_DAYS) {
      flags.push(`Stuck in ${deal.stage} for ${Math.floor(daysInStage)} days`);
      recommendations.push('Evaluate deal progress and consider next steps');
      score -= 25;
    }

    // Check activity diversity
    const activityTypes = new Set(activities.map((a) => a.type));
    if (activities.length >= 5 && activityTypes.size <= 1) {
      flags.push('Low activity diversity — only using one channel');
      recommendations.push(
        'Add multi-channel touchpoints (call, email, meeting)',
      );
      score -= 10;
    }

    // Check engagement signals
    const recentActivities = activities.filter(
      (a) => now - new Date(a.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000,
    );
    if (recentActivities.length === 0 && activities.length > 0) {
      flags.push('No recent engagement in last 30 days');
      score -= 15;
    }

    const riskLevel: DealHealthReport['riskLevel'] =
      score >= 70 ? 'healthy' : score >= 40 ? 'at_risk' : 'critical';

    return {
      dealId: deal.id,
      riskLevel,
      flags,
      recommendations,
      score: Math.max(0, score),
    };
  }
}
