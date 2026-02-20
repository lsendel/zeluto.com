import type { OrganizationId, ContactId } from '@mauntic/domain-kernel';
import { type AlertPriority, SignalAlert } from '../entities/signal-alert.js';
import type { SignalAlertRepository } from '../repositories/signal-alert-repository.js';

// Priority mapping: signal type → alert priority
const SIGNAL_PRIORITY_MAP: Record<string, AlertPriority> = {
  // Critical (1h SLA)
  DEMO_REQUEST: 'critical',
  PRICING_PAGE: 'critical',
  MEETING_SCHEDULED: 'critical',
  // High (4h SLA)
  FUNDING_ROUND: 'high',
  G2_RESEARCH: 'high',
  JOB_CHANGE: 'high',
  COMPETITOR_COMPARISON: 'high',
  FREE_TRIAL: 'high',
  CONTACT_REQUEST: 'high',
  // Medium (24h SLA)
  CONTENT_DOWNLOAD: 'medium',
  WEBINAR_ATTENDED: 'medium',
  CASE_STUDY_VIEW: 'medium',
  FORM_SUBMISSION: 'medium',
  EMAIL_CLICK: 'medium',
  // Low (72h SLA)
  WEBSITE_VISIT: 'low',
  EMAIL_OPEN: 'low',
  PROFILE_UPDATE: 'low',
};

export class SignalRouter {
  constructor(private readonly alertRepo: SignalAlertRepository) {}

  getPriority(signalType: string): AlertPriority {
    return SIGNAL_PRIORITY_MAP[signalType] ?? 'low';
  }

  async routeSignal(
    orgId: OrganizationId,
    contactId: ContactId,
    signalType: string,
  ): Promise<SignalAlert | null> {
    const priority = this.getPriority(signalType);

    // Only create alerts for critical and high priority signals
    if (priority !== 'critical' && priority !== 'high') return null;

    // Check if there's already an open alert for this contact and signal type
    const existingAlerts = await this.alertRepo.findByContact(orgId, contactId);
    const hasOpenAlert = existingAlerts.some(
      (a) => a.signalType === signalType && a.status === 'open',
    );
    if (hasOpenAlert) return null;

    const alert = SignalAlert.create({
      id: crypto.randomUUID(),
      organizationId: orgId,
      contactId,
      signalType,
      priority,
    });

    await this.alertRepo.save(alert);
    return alert;
  }

  async expireOverdueAlerts(orgId: OrganizationId): Promise<number> {
    const overdue = await this.alertRepo.findOverdue(orgId);
    let count = 0;
    for (const alert of overdue) {
      alert.markExpired();
      await this.alertRepo.save(alert);
      count++;
    }
    return count;
  }
}
