/**
 * Deliverability Diagnostics Service
 *
 * Analyzes delivery event data to produce actionable health reports.
 * Pure domain logic — no infrastructure dependencies.
 */

export interface DeliveryEventSummary {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
}

export type HealthGrade = 'excellent' | 'good' | 'warning' | 'critical';

export interface DeliverabilityReport {
  grade: HealthGrade;
  score: number; // 0-100
  metrics: DeliverabilityMetrics;
  issues: DeliverabilityIssue[];
  recommendations: string[];
}

export interface DeliverabilityMetrics {
  deliveryRate: number; // % delivered / sent
  bounceRate: number; // % bounced / sent
  complaintRate: number; // % complained / sent
  openRate: number; // % opened / delivered
  clickRate: number; // % clicked / delivered
  unsubscribeRate: number; // % unsubscribed / delivered
}

export interface DeliverabilityIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'reputation' | 'content' | 'infrastructure' | 'engagement';
  title: string;
  description: string;
}

// Industry threshold baselines
const THRESHOLDS = {
  bounceRate: { warning: 2, critical: 5 },
  complaintRate: { warning: 0.1, critical: 0.3 },
  deliveryRate: { warning: 95, critical: 90 },
  openRate: { low: 10, healthy: 20 },
  unsubscribeRate: { warning: 0.5, critical: 1 },
};

export class DeliverabilityDiagnostics {
  analyze(events: DeliveryEventSummary): DeliverabilityReport {
    const metrics = this.calculateMetrics(events);
    const issues = this.detectIssues(metrics, events);
    const score = this.calculateScore(metrics);
    const grade = this.gradeFromScore(score);
    const recommendations = this.generateRecommendations(issues, metrics);

    return { grade, score, metrics, issues, recommendations };
  }

  /**
   * Compare two periods to detect deliverability trends.
   */
  comparePeriods(
    current: DeliveryEventSummary,
    previous: DeliveryEventSummary,
  ): {
    report: DeliverabilityReport;
    trends: Record<keyof DeliverabilityMetrics, { delta: number; direction: 'up' | 'down' | 'stable' }>;
  } {
    const report = this.analyze(current);
    const prevMetrics = this.calculateMetrics(previous);

    const trends = {} as Record<
      keyof DeliverabilityMetrics,
      { delta: number; direction: 'up' | 'down' | 'stable' }
    >;

    for (const key of Object.keys(report.metrics) as Array<keyof DeliverabilityMetrics>) {
      const delta = report.metrics[key] - prevMetrics[key];
      trends[key] = {
        delta: Math.round(delta * 100) / 100,
        direction: Math.abs(delta) < 0.01 ? 'stable' : delta > 0 ? 'up' : 'down',
      };
    }

    return { report, trends };
  }

  private calculateMetrics(events: DeliveryEventSummary): DeliverabilityMetrics {
    const sent = Math.max(1, events.sent);
    const delivered = Math.max(1, events.delivered);

    return {
      deliveryRate: round((events.delivered / sent) * 100),
      bounceRate: round((events.bounced / sent) * 100),
      complaintRate: round((events.complained / sent) * 100),
      openRate: round((events.opened / delivered) * 100),
      clickRate: round((events.clicked / delivered) * 100),
      unsubscribeRate: round((events.unsubscribed / delivered) * 100),
    };
  }

  private detectIssues(
    metrics: DeliverabilityMetrics,
    events: DeliveryEventSummary,
  ): DeliverabilityIssue[] {
    const issues: DeliverabilityIssue[] = [];

    // Bounce rate
    if (metrics.bounceRate >= THRESHOLDS.bounceRate.critical) {
      issues.push({
        severity: 'critical',
        category: 'reputation',
        title: 'Critical bounce rate',
        description: `Bounce rate is ${metrics.bounceRate}% (threshold: ${THRESHOLDS.bounceRate.critical}%). This will damage sender reputation with ISPs.`,
      });
    } else if (metrics.bounceRate >= THRESHOLDS.bounceRate.warning) {
      issues.push({
        severity: 'warning',
        category: 'reputation',
        title: 'Elevated bounce rate',
        description: `Bounce rate is ${metrics.bounceRate}% (warning at ${THRESHOLDS.bounceRate.warning}%). Clean your contact list to prevent reputation damage.`,
      });
    }

    // Complaint rate
    if (metrics.complaintRate >= THRESHOLDS.complaintRate.critical) {
      issues.push({
        severity: 'critical',
        category: 'reputation',
        title: 'Critical complaint rate',
        description: `Complaint rate is ${metrics.complaintRate}% (threshold: ${THRESHOLDS.complaintRate.critical}%). ISPs may block your sending domain.`,
      });
    } else if (metrics.complaintRate >= THRESHOLDS.complaintRate.warning) {
      issues.push({
        severity: 'warning',
        category: 'reputation',
        title: 'Elevated complaint rate',
        description: `Complaint rate is ${metrics.complaintRate}% (warning at ${THRESHOLDS.complaintRate.warning}%). Review your opt-in process and email frequency.`,
      });
    }

    // Delivery rate
    if (metrics.deliveryRate < THRESHOLDS.deliveryRate.critical) {
      issues.push({
        severity: 'critical',
        category: 'infrastructure',
        title: 'Low delivery rate',
        description: `Only ${metrics.deliveryRate}% of emails are being delivered. Check DNS authentication (SPF, DKIM, DMARC) and sending domain configuration.`,
      });
    } else if (metrics.deliveryRate < THRESHOLDS.deliveryRate.warning) {
      issues.push({
        severity: 'warning',
        category: 'infrastructure',
        title: 'Below-average delivery rate',
        description: `Delivery rate is ${metrics.deliveryRate}%, below the ${THRESHOLDS.deliveryRate.warning}% target. Investigate bounce reasons.`,
      });
    }

    // Open rate (engagement signal)
    if (events.sent >= 100 && metrics.openRate < THRESHOLDS.openRate.low) {
      issues.push({
        severity: 'warning',
        category: 'engagement',
        title: 'Low open rate',
        description: `Open rate is ${metrics.openRate}%. This may indicate poor subject lines, wrong send times, or inbox placement issues.`,
      });
    }

    // Unsubscribe rate
    if (metrics.unsubscribeRate >= THRESHOLDS.unsubscribeRate.critical) {
      issues.push({
        severity: 'warning',
        category: 'content',
        title: 'High unsubscribe rate',
        description: `Unsubscribe rate is ${metrics.unsubscribeRate}%. Review content relevance and segmentation.`,
      });
    }

    // Low volume warning
    if (events.sent < 50) {
      issues.push({
        severity: 'info',
        category: 'infrastructure',
        title: 'Low sending volume',
        description: `Only ${events.sent} emails sent in this period. Metrics may not be statistically reliable.`,
      });
    }

    return issues.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }

  private calculateScore(metrics: DeliverabilityMetrics): number {
    let score = 100;

    // Delivery rate impact (heaviest weight)
    if (metrics.deliveryRate < 90) score -= 40;
    else if (metrics.deliveryRate < 95) score -= 20;
    else if (metrics.deliveryRate < 98) score -= 5;

    // Bounce rate impact
    if (metrics.bounceRate >= 5) score -= 25;
    else if (metrics.bounceRate >= 2) score -= 10;

    // Complaint rate impact
    if (metrics.complaintRate >= 0.3) score -= 25;
    else if (metrics.complaintRate >= 0.1) score -= 10;

    // Engagement bonus
    if (metrics.openRate >= 20) score += 5;

    // Unsubscribe penalty
    if (metrics.unsubscribeRate >= 1) score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  private gradeFromScore(score: number): HealthGrade {
    if (score >= 90) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'warning';
    return 'critical';
  }

  private generateRecommendations(
    issues: DeliverabilityIssue[],
    metrics: DeliverabilityMetrics,
  ): string[] {
    const recs: string[] = [];

    const hasReputation = issues.some((i) => i.category === 'reputation');
    const hasInfra = issues.some((i) => i.category === 'infrastructure');
    const hasEngagement = issues.some((i) => i.category === 'engagement');
    const hasContent = issues.some((i) => i.category === 'content');

    if (hasReputation) {
      recs.push(
        'Clean your contact list — remove hard bounces and inactive subscribers.',
      );
      recs.push(
        'Implement double opt-in to ensure valid, engaged subscribers.',
      );
    }

    if (hasInfra) {
      recs.push(
        'Verify SPF, DKIM, and DMARC records on your sending domain.',
      );
      if (metrics.deliveryRate < 95) {
        recs.push(
          'Check if your sending IP is on any blocklists (MXToolbox, Spamhaus).',
        );
      }
    }

    if (hasEngagement) {
      recs.push(
        'A/B test subject lines to improve open rates.',
      );
      recs.push(
        'Segment your audience and send more targeted content.',
      );
    }

    if (hasContent) {
      recs.push(
        'Review email frequency — consider letting contacts set preferences.',
      );
      recs.push(
        'Make unsubscribe easy and visible to reduce spam complaints.',
      );
    }

    if (issues.length === 0) {
      recs.push(
        'Deliverability looks healthy. Continue monitoring and maintain list hygiene.',
      );
    }

    return recs;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
