import { describe, expect, it } from 'vitest';
import type { ActivityProps } from '../entities/activity.js';
import type { DealProps } from '../entities/deal.js';
import { NextBestActionAdvisor } from './next-best-action.js';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const DEAL_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';

function buildDeal(overrides?: Partial<DealProps>): DealProps {
  return {
    id: DEAL_ID,
    organizationId: ORG_ID,
    contactId: CONTACT_ID,
    name: 'ACME Expansion',
    stage: 'qualification',
    value: 50000,
    probability: 30,
    priority: 'high',
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-10T00:00:00.000Z'),
    ...overrides,
  };
}

function buildActivity(overrides?: Partial<ActivityProps>): ActivityProps {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    organizationId: ORG_ID,
    type: 'email',
    contactId: CONTACT_ID,
    dealId: DEAL_ID,
    createdAt: new Date('2026-02-10T00:00:00.000Z'),
    ...overrides,
  };
}

describe('NextBestActionAdvisor', () => {
  it('recommends rescue call for critical inactivity', () => {
    const advisor = new NextBestActionAdvisor();
    const now = new Date('2026-03-01T00:00:00.000Z');
    const recommendation = advisor.recommend({
      deal: buildDeal({
        stage: 'proposal',
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
      activities: [
        buildActivity({ createdAt: new Date('2026-02-01T00:00:00.000Z') }),
      ],
      now,
    });

    expect(recommendation.action.type).toBe('rescue_call');
    expect(recommendation.action.priority).toBe('urgent');
    expect(recommendation.risk.level).toBe('at_risk');
    expect(recommendation.explainability.signals.length).toBeGreaterThan(0);
  });

  it('recommends discovery meeting when early-stage lacks live touchpoints', () => {
    const advisor = new NextBestActionAdvisor();
    const recommendation = advisor.recommend({
      deal: buildDeal({
        stage: 'needs_analysis',
        updatedAt: new Date('2026-02-19T00:00:00.000Z'),
      }),
      activities: [
        buildActivity({
          type: 'email',
          createdAt: new Date('2026-02-18T00:00:00.000Z'),
        }),
        buildActivity({
          id: '55555555-5555-4555-8555-555555555555',
          type: 'linkedin',
          createdAt: new Date('2026-02-19T00:00:00.000Z'),
        }),
      ],
      now: new Date('2026-02-20T00:00:00.000Z'),
    });

    expect(recommendation.action.type).toBe('discovery_meeting');
    expect(recommendation.risk.level).toBe('healthy');
  });

  it('returns no action for closed deals', () => {
    const advisor = new NextBestActionAdvisor();
    const recommendation = advisor.recommend({
      deal: buildDeal({
        stage: 'closed_won',
      }),
      activities: [],
      now: new Date('2026-02-20T00:00:00.000Z'),
    });

    expect(recommendation.action.type).toBe('none');
    expect(recommendation.action.dueInHours).toBe(0);
  });
});
