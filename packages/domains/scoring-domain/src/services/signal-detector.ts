import type { AnyDomainEvent } from '@mauntic/domain-kernel';
import { IntentSignal } from '../entities/intent-signal.js';
import type { SignalConfigRepository } from '../repositories/signal-config-repository.js';

export interface DetectedSignal {
  signalType: string;
  source: string;
  weight: number;
  contactId: string;
  metadata?: Record<string, unknown>;
}

// Maps domain event types to signal types
const EVENT_SIGNAL_MAP: Record<
  string,
  { signalType: string; defaultWeight: number; source: string }
> = {
  'content.PageVisited': {
    signalType: 'WEBSITE_VISIT',
    defaultWeight: 5,
    source: 'content',
  },
  'content.FormSubmitted': {
    signalType: 'FORM_SUBMISSION',
    defaultWeight: 15,
    source: 'content',
  },
  'content.AssetDownloaded': {
    signalType: 'CONTENT_DOWNLOAD',
    defaultWeight: 10,
    source: 'content',
  },
  'delivery.MessageOpened': {
    signalType: 'EMAIL_OPEN',
    defaultWeight: 3,
    source: 'delivery',
  },
  'delivery.MessageClicked': {
    signalType: 'EMAIL_CLICK',
    defaultWeight: 8,
    source: 'delivery',
  },
  'crm.ContactUpdated': {
    signalType: 'PROFILE_UPDATE',
    defaultWeight: 2,
    source: 'crm',
  },
};

// URL-based signal overrides
const URL_SIGNAL_OVERRIDES: Array<{
  pattern: RegExp;
  signalType: string;
  weight: number;
}> = [
  { pattern: /\/pricing/i, signalType: 'PRICING_PAGE', weight: 20 },
  { pattern: /\/demo/i, signalType: 'DEMO_REQUEST', weight: 30 },
  { pattern: /\/free-trial/i, signalType: 'FREE_TRIAL', weight: 25 },
  { pattern: /\/case-stud/i, signalType: 'CASE_STUDY_VIEW', weight: 12 },
  { pattern: /\/comparison/i, signalType: 'COMPETITOR_COMPARISON', weight: 15 },
];

export class SignalDetector {
  constructor(private readonly signalConfigRepo: SignalConfigRepository) {}

  async detect(
    orgId: string,
    event: AnyDomainEvent,
  ): Promise<DetectedSignal | null> {
    const mapping = EVENT_SIGNAL_MAP[event.type];
    if (!mapping) return null;

    const data = event.data as Record<string, unknown>;
    const contactId = data.contactId as string | undefined;
    if (!contactId) return null;

    let signalType = mapping.signalType;
    let weight = mapping.defaultWeight;

    // Check URL-based overrides for page visits
    if (event.type === 'content.PageVisited') {
      const url = (data.url as string) ?? '';
      for (const override of URL_SIGNAL_OVERRIDES) {
        if (override.pattern.test(url)) {
          signalType = override.signalType;
          weight = override.weight;
          break;
        }
      }
    }

    // Check form type for form submissions
    if (event.type === 'content.FormSubmitted') {
      const formType = (data.formType as string) ?? '';
      if (formType === 'demo') {
        signalType = 'DEMO_REQUEST';
        weight = 30;
      } else if (formType === 'contact') {
        signalType = 'CONTACT_REQUEST';
        weight = 20;
      }
    }

    // Apply org-level config overrides
    const config = await this.signalConfigRepo.findBySignalType(
      orgId,
      signalType,
    );
    if (config) {
      if (!config.enabled) return null;
      weight = config.weight;
    }

    return {
      signalType,
      source: mapping.source,
      weight,
      contactId,
      metadata: { eventType: event.type, ...data },
    };
  }

  async createSignal(
    orgId: string,
    detected: DetectedSignal,
  ): Promise<IntentSignal> {
    const config = await this.signalConfigRepo.findBySignalType(
      orgId,
      detected.signalType,
    );
    const decayHours = config?.decayHours ?? 168;

    return IntentSignal.create({
      id: crypto.randomUUID(),
      organizationId: orgId,
      contactId: detected.contactId,
      signalType: detected.signalType,
      source: detected.source,
      weight: detected.weight,
      decayHours,
      metadata: detected.metadata,
    });
  }
}
