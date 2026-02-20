import { describe, expect, it } from 'vitest';

describe('Lead Routing', () => {
  describe('Round Robin Strategy', () => {
    it('should rotate through reps evenly', () => {
      const reps = ['rep-1', 'rep-2', 'rep-3'];
      let lastIndex = -1;

      const selectRep = () => {
        lastIndex = (lastIndex + 1) % reps.length;
        return reps[lastIndex];
      };

      expect(selectRep()).toBe('rep-1');
      expect(selectRep()).toBe('rep-2');
      expect(selectRep()).toBe('rep-3');
      expect(selectRep()).toBe('rep-1'); // wraps around
    });
  });

  describe('Rule Priority Matching', () => {
    const rules = [
      {
        name: 'Enterprise',
        priority: 10,
        conditions: { minDealValue: 50000 },
        targetReps: ['rep-1', 'rep-2'],
      },
      {
        name: 'SMB',
        priority: 5,
        conditions: { maxDealValue: 50000 },
        targetReps: ['rep-3', 'rep-4'],
      },
      { name: 'Default', priority: 0, conditions: {}, targetReps: ['rep-5'] },
    ];

    it('should match rules by priority order', () => {
      const sorted = [...rules].sort((a, b) => b.priority - a.priority);

      expect(sorted[0].name).toBe('Enterprise');
      expect(sorted[1].name).toBe('SMB');
      expect(sorted[2].name).toBe('Default');
    });

    it('should select enterprise rule for high-value deals', () => {
      const dealValue = 75000;
      const sorted = [...rules].sort((a, b) => b.priority - a.priority);

      const matchedRule = sorted.find((r) => {
        const conds = r.conditions as Record<string, number>;
        if (conds.minDealValue && dealValue < conds.minDealValue) return false;
        if (conds.maxDealValue && dealValue > conds.maxDealValue) return false;
        return true;
      });

      expect(matchedRule?.name).toBe('Enterprise');
    });

    it('should select SMB rule for low-value deals', () => {
      const dealValue = 15000;
      const sorted = [...rules].sort((a, b) => b.priority - a.priority);

      const matchedRule = sorted.find((r) => {
        const conds = r.conditions as Record<string, number>;
        if (conds.minDealValue && dealValue < conds.minDealValue) return false;
        if (conds.maxDealValue && dealValue > conds.maxDealValue) return false;
        return true;
      });

      expect(matchedRule?.name).toBe('SMB');
    });
  });

  describe('Prospect Qualification', () => {
    it('should recommend enrich when data completeness is low', () => {
      const recommendation = determineRecommendation(0.3, 70, 0.8);
      expect(recommendation).toBe('enrich');
    });

    it('should recommend sequence for high score and ICP match', () => {
      const recommendation = determineRecommendation(0.8, 75, 0.8);
      expect(recommendation).toBe('sequence');
    });

    it('should recommend skip for low score and ICP match', () => {
      const recommendation = determineRecommendation(0.8, 20, 0.2);
      expect(recommendation).toBe('skip');
    });

    it('should recommend manual_review for ambiguous cases', () => {
      const recommendation = determineRecommendation(0.8, 50, 0.5);
      expect(recommendation).toBe('manual_review');
    });
  });
});

function determineRecommendation(
  dataCompleteness: number,
  score: number,
  icpMatch: number,
): 'enrich' | 'sequence' | 'skip' | 'manual_review' {
  if (dataCompleteness < 0.5) return 'enrich';
  if (score >= 70 && icpMatch >= 0.7) return 'sequence';
  if (score < 30 || icpMatch < 0.3) return 'skip';
  return 'manual_review';
}
