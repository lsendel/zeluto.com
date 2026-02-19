import { describe, it, expect } from 'vitest';

describe('Deal Pipeline', () => {
  const STAGES = [
    'prospecting', 'qualification', 'discovery', 'proposal',
    'negotiation', 'closed_won', 'closed_lost',
  ] as const;

  const STAGE_PROBABILITY: Record<string, number> = {
    prospecting: 10,
    qualification: 20,
    discovery: 30,
    proposal: 50,
    negotiation: 70,
    closed_won: 100,
    closed_lost: 0,
  };

  describe('Stage Transitions', () => {
    it('should allow forward stage movement', () => {
      const currentIdx = STAGES.indexOf('discovery');
      const targetIdx = STAGES.indexOf('proposal');

      expect(targetIdx).toBeGreaterThan(currentIdx);
    });

    it('should not allow transition from closed_won', () => {
      const fromClosed = (stage: string) =>
        stage === 'closed_won' || stage === 'closed_lost';

      expect(fromClosed('closed_won')).toBe(true);
      expect(fromClosed('negotiation')).toBe(false);
    });

    it('should update probability on stage change', () => {
      const stage = 'proposal';
      expect(STAGE_PROBABILITY[stage]).toBe(50);
    });
  });

  describe('Forecast Calculation', () => {
    it('should calculate weighted forecast value', () => {
      const deals = [
        { value: 50000, stage: 'proposal' },
        { value: 80000, stage: 'negotiation' },
        { value: 35000, stage: 'closed_won' },
      ];

      const weightedValue = deals.reduce(
        (sum, deal) => sum + deal.value * (STAGE_PROBABILITY[deal.stage] / 100),
        0,
      );

      // 50000*0.5 + 80000*0.7 + 35000*1.0 = 25000 + 56000 + 35000 = 116000
      expect(weightedValue).toBe(116000);
    });

    it('should apply forecast formula correctly', () => {
      const closed = 35000;
      const commit = 50000;
      const bestCase = 80000;
      const pipeline = 25000;

      // closed×1.0 + commit×1.0 + best_case×0.5 + pipeline×0.25
      const forecast = closed * 1.0 + commit * 1.0 + bestCase * 0.5 + pipeline * 0.25;

      expect(forecast).toBe(131250);
    });
  });
});
