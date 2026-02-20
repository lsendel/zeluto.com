import { describe, expect, it } from 'vitest';

describe('Scoring Engine', () => {
  describe('Grade Calculation', () => {
    const calculateGrade = (score: number): string => {
      if (score >= 80) return 'A';
      if (score >= 60) return 'B';
      if (score >= 40) return 'C';
      if (score >= 20) return 'D';
      return 'F';
    };

    it('should assign grade A for scores 80-100', () => {
      expect(calculateGrade(80)).toBe('A');
      expect(calculateGrade(100)).toBe('A');
      expect(calculateGrade(95)).toBe('A');
    });

    it('should assign grade B for scores 60-79', () => {
      expect(calculateGrade(60)).toBe('B');
      expect(calculateGrade(79)).toBe('B');
    });

    it('should assign grade C for scores 40-59', () => {
      expect(calculateGrade(40)).toBe('C');
      expect(calculateGrade(59)).toBe('C');
    });

    it('should assign grade D for scores 20-39', () => {
      expect(calculateGrade(20)).toBe('D');
      expect(calculateGrade(39)).toBe('D');
    });

    it('should assign grade F for scores 0-19', () => {
      expect(calculateGrade(0)).toBe('F');
      expect(calculateGrade(19)).toBe('F');
    });
  });

  describe('Rule-Based Scoring', () => {
    const DEFAULT_WEIGHTS: Record<
      string,
      { points: number; category: string }
    > = {
      company_size: { points: 15, category: 'fit' },
      industry_match: { points: 15, category: 'fit' },
      email_opens: { points: 5, category: 'engagement' },
      email_clicks: { points: 10, category: 'engagement' },
      pricing_page_visit: { points: 20, category: 'intent' },
      demo_request: { points: 30, category: 'intent' },
    };

    it('should calculate score from matching factors', () => {
      const matchedFactors = [
        'company_size',
        'email_clicks',
        'pricing_page_visit',
      ];
      const totalScore = matchedFactors.reduce(
        (sum, factor) => sum + (DEFAULT_WEIGHTS[factor]?.points ?? 0),
        0,
      );

      expect(totalScore).toBe(45); // 15 + 10 + 20
    });

    it('should clamp score to 0-100 range', () => {
      const clamp = (score: number) => Math.max(0, Math.min(100, score));

      expect(clamp(-10)).toBe(0);
      expect(clamp(150)).toBe(100);
      expect(clamp(50)).toBe(50);
    });

    it('should identify top contributors sorted by points', () => {
      const matchedFactors = ['email_opens', 'demo_request', 'company_size'];
      const contributors = matchedFactors
        .map((factor) => ({
          factor,
          points: DEFAULT_WEIGHTS[factor]?.points ?? 0,
        }))
        .sort((a, b) => b.points - a.points);

      expect(contributors[0].factor).toBe('demo_request');
      expect(contributors[0].points).toBe(30);
    });
  });

  describe('Score Threshold Crossing', () => {
    const THRESHOLDS = [20, 40, 60, 80];

    it('should detect upward threshold crossing', () => {
      const previousScore = 55;
      const newScore = 65;

      const crossedUp = THRESHOLDS.filter(
        (t) => newScore >= t && previousScore < t,
      );

      expect(crossedUp).toEqual([60]);
    });

    it('should detect downward threshold crossing', () => {
      const previousScore = 85;
      const newScore = 75;

      const crossedDown = THRESHOLDS.filter(
        (t) => previousScore >= t && newScore < t,
      );

      expect(crossedDown).toEqual([80]);
    });

    it('should detect multiple threshold crossings', () => {
      const previousScore = 15;
      const newScore = 65;

      const crossedUp = THRESHOLDS.filter(
        (t) => newScore >= t && previousScore < t,
      );

      expect(crossedUp).toEqual([20, 40, 60]);
    });

    it('should detect no crossing when score stays in same range', () => {
      const crossedUp = THRESHOLDS.filter((t) => 75 >= t && 70 < t);

      expect(crossedUp).toEqual([]);
    });
  });
});
