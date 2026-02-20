import type { ActivityProps } from '../entities/activity.js';
import type { DealProps } from '../entities/deal.js';
import { type DealHealthReport, DealInspector } from './deal-inspector.js';

export type NextBestActionType =
  | 'rescue_call'
  | 'reengagement_sequence'
  | 'discovery_meeting'
  | 'mutual_action_plan'
  | 'close_plan_review'
  | 'none';

export interface ExplainabilitySignal {
  key: string;
  label: string;
  value: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  reason: string;
}

export interface ExplainabilityTrail {
  summary: string;
  confidence: number;
  generatedAt: string;
  signals: ExplainabilitySignal[];
}

export interface NextBestActionRecommendation {
  dealId: string;
  action: {
    type: NextBestActionType;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    title: string;
    reason: string;
    dueInHours: number;
    playbook: string[];
  };
  risk: {
    level: DealHealthReport['riskLevel'];
    score: number;
    flags: string[];
  };
  explainability: ExplainabilityTrail;
}

export class NextBestActionAdvisor {
  constructor(
    private readonly inspector: DealInspector = new DealInspector(),
  ) {}

  recommend(input: {
    deal: DealProps;
    activities: ActivityProps[];
    healthReport?: DealHealthReport;
    now?: Date;
  }): NextBestActionRecommendation {
    const now = input.now ?? new Date();
    const healthReport =
      input.healthReport ??
      this.inspector.inspect(input.deal, input.activities);
    const explainability = this.explain({
      deal: input.deal,
      activities: input.activities,
      healthReport,
      now,
    });
    const action = this.selectAction(
      input.deal,
      input.activities,
      healthReport,
      explainability,
      now,
    );

    return {
      dealId: input.deal.id,
      action,
      risk: {
        level: healthReport.riskLevel,
        score: healthReport.score,
        flags: healthReport.flags,
      },
      explainability,
    };
  }

  explain(input: {
    deal: DealProps;
    activities: ActivityProps[];
    healthReport?: DealHealthReport;
    now?: Date;
  }): ExplainabilityTrail {
    const now = input.now ?? new Date();
    const healthReport =
      input.healthReport ??
      this.inspector.inspect(input.deal, input.activities);
    const daysSinceActivity = this.calculateDaysSinceActivity(
      input.deal,
      input.activities,
      now,
    );
    const daysInStage = this.calculateDaysInStage(input.deal, now);
    const activityMix = new Set(
      input.activities.map((activity) => activity.type),
    ).size;
    const recentMeetings = input.activities.filter(
      (activity) =>
        (activity.type === 'meeting' || activity.type === 'demo') &&
        this.daysBetween(activity.createdAt, now) <= 14,
    ).length;

    const signals: ExplainabilitySignal[] = [
      {
        key: 'risk-level',
        label: 'Deal risk level',
        value: `${healthReport.riskLevel} (${healthReport.score}/100)`,
        impact:
          healthReport.riskLevel === 'critical'
            ? 'negative'
            : healthReport.riskLevel === 'at_risk'
              ? 'neutral'
              : 'positive',
        weight: 0.35,
        reason:
          'The inspector score is the strongest predictor for intervention urgency.',
      },
      {
        key: 'activity-recency',
        label: 'Last activity recency',
        value: `${daysSinceActivity} days`,
        impact:
          daysSinceActivity >= 14
            ? 'negative'
            : daysSinceActivity >= 7
              ? 'neutral'
              : 'positive',
        weight: 0.25,
        reason:
          'Long inactivity windows correlate with lower stage conversion and higher slip risk.',
      },
      {
        key: 'stage-velocity',
        label: 'Time in current stage',
        value: `${daysInStage} days in ${input.deal.stage}`,
        impact: daysInStage >= 21 ? 'negative' : 'neutral',
        weight: 0.2,
        reason:
          'Deals stalling in one stage usually need a focused plan to unblock stakeholders.',
      },
      {
        key: 'activity-mix',
        label: 'Channel diversity',
        value: `${activityMix} channel(s), ${recentMeetings} recent meeting/demo`,
        impact:
          activityMix <= 1 || recentMeetings === 0 ? 'neutral' : 'positive',
        weight: 0.2,
        reason:
          'Multi-channel and live interactions improve response rates compared with single-channel outreach.',
      },
    ];

    const confidence = this.calculateConfidence(
      input.deal,
      input.activities,
      healthReport,
    );
    const summary = this.buildSummary(
      input.deal,
      healthReport,
      daysSinceActivity,
      daysInStage,
    );

    return {
      summary,
      confidence,
      generatedAt: now.toISOString(),
      signals,
    };
  }

  private selectAction(
    deal: DealProps,
    activities: ActivityProps[],
    healthReport: DealHealthReport,
    explainability: ExplainabilityTrail,
    now: Date,
  ): NextBestActionRecommendation['action'] {
    if (deal.stage === 'closed_won' || deal.stage === 'closed_lost') {
      return {
        type: 'none',
        priority: 'low',
        title: 'No immediate action required',
        reason: 'Deal is already closed.',
        dueInHours: 0,
        playbook: ['Archive active tasks and log closure context.'],
      };
    }

    const daysSinceActivity = this.calculateDaysSinceActivity(
      deal,
      activities,
      now,
    );
    const daysInStage = this.calculateDaysInStage(deal, now);
    const recentMeetings = activities.filter(
      (activity) =>
        (activity.type === 'meeting' || activity.type === 'demo') &&
        this.daysBetween(activity.createdAt, now) <= 14,
    ).length;

    if (healthReport.riskLevel === 'critical' || daysSinceActivity >= 14) {
      return {
        type: 'rescue_call',
        priority: 'urgent',
        title: 'Run a rescue call and secure a next step',
        reason: explainability.summary,
        dueInHours: 4,
        playbook: [
          'Review unresolved objections and the last 3 touchpoints before outreach.',
          'Send a concise agenda and 2 concrete outcomes for the call.',
          'Book a live call within 48 hours and confirm owner + deadline.',
        ],
      };
    }

    if (healthReport.riskLevel === 'at_risk' || daysSinceActivity >= 7) {
      return {
        type: 'reengagement_sequence',
        priority: 'high',
        title: 'Launch a short re-engagement sequence',
        reason: explainability.summary,
        dueInHours: 12,
        playbook: [
          'Send a value-focused recap tied to the buyer priority.',
          'Follow with a call/LinkedIn touchpoint within 24 hours.',
          'Escalate to an alternate stakeholder if no response in 72 hours.',
        ],
      };
    }

    if (
      (deal.stage === 'prospecting' ||
        deal.stage === 'qualification' ||
        deal.stage === 'needs_analysis') &&
      recentMeetings === 0
    ) {
      return {
        type: 'discovery_meeting',
        priority: 'high',
        title: 'Secure a discovery meeting',
        reason: explainability.summary,
        dueInHours: 24,
        playbook: [
          'Send 2 discovery time options plus a one-line agenda.',
          'Tie outreach to a quantified business outcome.',
          'Capture decision criteria and timeline during the meeting.',
        ],
      };
    }

    if (deal.stage === 'proposal' || deal.stage === 'negotiation') {
      return {
        type: 'mutual_action_plan',
        priority: 'medium',
        title: 'Propose a mutual action plan (MAP)',
        reason: explainability.summary,
        dueInHours: 24,
        playbook: [
          'Share a dated milestone plan from security review to signature.',
          'Identify owner per milestone on both buyer and seller sides.',
          'Schedule a checkpoint to validate blockers and adjust dates.',
        ],
      };
    }

    if (deal.stage === 'contract_sent' || daysInStage >= 21) {
      return {
        type: 'close_plan_review',
        priority: 'medium',
        title: 'Run a close plan review with procurement/legal',
        reason: explainability.summary,
        dueInHours: 24,
        playbook: [
          'Confirm contract redline status and approval sequence.',
          'Escalate legal/procurement blockers with exact turnaround dates.',
          'Lock final signature date and responsible approvers.',
        ],
      };
    }

    return {
      type: 'reengagement_sequence',
      priority: 'medium',
      title: 'Maintain momentum with a focused follow-up',
      reason: explainability.summary,
      dueInHours: 48,
      playbook: [
        'Send one concrete next step and target date.',
        'Reinforce expected business impact with one proof point.',
        'Confirm decision process and stakeholder map.',
      ],
    };
  }

  private calculateConfidence(
    deal: DealProps,
    activities: ActivityProps[],
    healthReport: DealHealthReport,
  ): number {
    let confidence = 0.55;
    if (activities.length >= 5) confidence += 0.15;
    if (activities.length >= 10) confidence += 0.1;
    if (deal.assignedRep) confidence += 0.05;
    if (healthReport.flags.length > 0) confidence += 0.05;
    if (activities.length === 0) confidence -= 0.2;
    return clamp(round(confidence), 0.2, 0.95);
  }

  private buildSummary(
    deal: DealProps,
    healthReport: DealHealthReport,
    daysSinceActivity: number,
    daysInStage: number,
  ): string {
    if (healthReport.riskLevel === 'critical') {
      return `Deal is critical with ${daysSinceActivity} inactive day(s) and ${daysInStage} day(s) in ${deal.stage}.`;
    }
    if (healthReport.riskLevel === 'at_risk') {
      return `Deal is at risk due to ${daysSinceActivity} inactive day(s) and slower stage velocity (${daysInStage} day(s)).`;
    }
    return `Deal is healthy but can improve momentum from ${deal.stage} with a focused next step.`;
  }

  private calculateDaysSinceActivity(
    deal: DealProps,
    activities: ActivityProps[],
    now: Date,
  ): number {
    const lastActivityAt =
      activities.length > 0
        ? Math.max(
            ...activities.map((activity) =>
              new Date(activity.createdAt).valueOf(),
            ),
          )
        : new Date(deal.createdAt).valueOf();
    return Math.floor((now.valueOf() - lastActivityAt) / (1000 * 60 * 60 * 24));
  }

  private calculateDaysInStage(deal: DealProps, now: Date): number {
    return Math.floor(
      (now.valueOf() - new Date(deal.updatedAt).valueOf()) /
        (1000 * 60 * 60 * 24),
    );
  }

  private daysBetween(start: Date, end: Date): number {
    return (end.valueOf() - start.valueOf()) / (1000 * 60 * 60 * 24);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
