import { describe, expect, it } from 'vitest';
import { CrmConflictPolicy } from './crm-conflict-policy.js';
import {
  EnvironmentPromotion,
  InvalidPromotionPathError,
} from './environment-promotion.js';

describe('EnvironmentPromotion', () => {
  it('enforces valid promotion path and lifecycle transitions', () => {
    const promotion = EnvironmentPromotion.create({
      organizationId: '11111111-1111-4111-8111-111111111111',
      sourceEnvironment: 'dev',
      targetEnvironment: 'stage',
      scope: {
        connectionIds: ['22222222-2222-4222-8222-222222222222'],
        oauthAppIds: [],
        webhookIds: [],
      },
      requestedBy: '33333333-3333-4333-8333-333333333333',
      requestedAt: new Date('2026-02-20T00:00:00.000Z'),
    });

    promotion.approve({
      reviewedBy: '44444444-4444-4444-8444-444444444444',
      reviewedAt: new Date('2026-02-20T01:00:00.000Z'),
    });
    promotion.apply({ appliedAt: new Date('2026-02-20T02:00:00.000Z') });

    expect(promotion.toProps().status).toBe('applied');
    expect(promotion.toProps().appliedAt?.toISOString()).toBe(
      '2026-02-20T02:00:00.000Z',
    );
  });

  it('rejects unsupported environment paths', () => {
    expect(() =>
      EnvironmentPromotion.create({
        organizationId: '11111111-1111-4111-8111-111111111111',
        sourceEnvironment: 'dev',
        targetEnvironment: 'prod',
        scope: {
          connectionIds: ['22222222-2222-4222-8222-222222222222'],
          oauthAppIds: [],
          webhookIds: [],
        },
        requestedBy: '33333333-3333-4333-8333-333333333333',
      }),
    ).toThrow(InvalidPromotionPathError);
  });
});

describe('CrmConflictPolicy', () => {
  it('resolves using field override strategy', () => {
    const policy = CrmConflictPolicy.create({
      organizationId: '11111111-1111-4111-8111-111111111111',
      connectionId: '22222222-2222-4222-8222-222222222222',
      createdBy: '33333333-3333-4333-8333-333333333333',
      defaultStrategy: 'most_recent_wins',
      fieldStrategies: {
        email: 'crm_wins',
      },
    });

    const decision = policy.resolve({
      field: 'email',
      localUpdatedAt: '2026-02-20T00:00:00.000Z',
      remoteUpdatedAt: '2026-02-19T00:00:00.000Z',
    });

    expect(decision).toEqual({ strategy: 'crm_wins', side: 'crm' });
  });

  it('resolves most recent strategy deterministically', () => {
    const policy = CrmConflictPolicy.create({
      organizationId: '11111111-1111-4111-8111-111111111111',
      createdBy: '33333333-3333-4333-8333-333333333333',
      defaultStrategy: 'most_recent_wins',
    });

    const decision = policy.resolve({
      field: 'phone',
      localUpdatedAt: '2026-02-20T00:00:00.000Z',
      remoteUpdatedAt: '2026-02-21T00:00:00.000Z',
    });

    expect(decision).toEqual({
      strategy: 'most_recent_wins',
      side: 'crm',
    });
  });
});
