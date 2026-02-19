import { describe, it, expect } from 'vitest';

describe('Signal Detection', () => {
  describe('Signal Time Decay', () => {
    const linearDecay = (weight: number, hoursElapsed: number, decayHours: number): number => {
      const remaining = Math.max(0, 1 - hoursElapsed / decayHours);
      return weight * remaining;
    };

    const exponentialDecay = (weight: number, hoursElapsed: number, halfLife: number): number => {
      return weight * Math.pow(0.5, hoursElapsed / halfLife);
    };

    it('should apply linear decay correctly', () => {
      const weight = 20;
      const decayHours = 168; // 7 days

      expect(linearDecay(weight, 0, decayHours)).toBe(20);
      expect(linearDecay(weight, 84, decayHours)).toBe(10); // Half decay
      expect(linearDecay(weight, 168, decayHours)).toBe(0); // Fully decayed
      expect(linearDecay(weight, 200, decayHours)).toBe(0); // Beyond decay
    });

    it('should apply exponential decay correctly', () => {
      const weight = 20;
      const halfLife = 72; // 3 days

      expect(exponentialDecay(weight, 0, halfLife)).toBe(20);
      expect(exponentialDecay(weight, 72, halfLife)).toBeCloseTo(10, 1);
      expect(exponentialDecay(weight, 144, halfLife)).toBeCloseTo(5, 1);
    });

    it('should identify expired signals', () => {
      const isExpired = (hoursElapsed: number, decayHours: number) =>
        hoursElapsed >= decayHours;

      expect(isExpired(100, 168)).toBe(false);
      expect(isExpired(168, 168)).toBe(true);
      expect(isExpired(200, 168)).toBe(true);
    });
  });

  describe('Signal Alert SLA', () => {
    const SLA_HOURS: Record<string, number> = {
      critical: 1,
      high: 4,
      medium: 24,
      low: 72,
    };

    it('should set correct SLA deadline for critical signals', () => {
      const now = new Date('2026-02-19T10:00:00Z');
      const deadline = new Date(now.getTime() + SLA_HOURS.critical * 60 * 60 * 1000);

      expect(deadline.toISOString()).toBe('2026-02-19T11:00:00.000Z');
    });

    it('should set correct SLA deadline for high signals', () => {
      const now = new Date('2026-02-19T10:00:00Z');
      const deadline = new Date(now.getTime() + SLA_HOURS.high * 60 * 60 * 1000);

      expect(deadline.toISOString()).toBe('2026-02-19T14:00:00.000Z');
    });

    it('should identify overdue alerts', () => {
      const isOverdue = (deadline: Date) => new Date() > deadline;

      const pastDeadline = new Date(Date.now() - 60000);
      const futureDeadline = new Date(Date.now() + 60000);

      expect(isOverdue(pastDeadline)).toBe(true);
      expect(isOverdue(futureDeadline)).toBe(false);
    });
  });

  describe('URL-Based Signal Detection', () => {
    const URL_SIGNAL_OVERRIDES: Record<string, { signalType: string; weight: number }> = {
      pricing: { signalType: 'PRICING_PAGE', weight: 20 },
      demo: { signalType: 'DEMO_REQUEST', weight: 30 },
      'free-trial': { signalType: 'FREE_TRIAL', weight: 25 },
    };

    function detectSignalFromUrl(url: string): { signalType: string; weight: number } | null {
      for (const [keyword, signal] of Object.entries(URL_SIGNAL_OVERRIDES)) {
        if (url.toLowerCase().includes(keyword)) {
          return signal;
        }
      }
      return null;
    }

    it('should detect pricing page visit', () => {
      const signal = detectSignalFromUrl('/products/pricing');
      expect(signal?.signalType).toBe('PRICING_PAGE');
      expect(signal?.weight).toBe(20);
    });

    it('should detect demo request page', () => {
      const signal = detectSignalFromUrl('/schedule-demo');
      expect(signal?.signalType).toBe('DEMO_REQUEST');
      expect(signal?.weight).toBe(30);
    });

    it('should detect free trial page', () => {
      const signal = detectSignalFromUrl('/start-free-trial');
      expect(signal?.signalType).toBe('FREE_TRIAL');
      expect(signal?.weight).toBe(25);
    });

    it('should return null for non-signal pages', () => {
      const signal = detectSignalFromUrl('/blog/latest-news');
      expect(signal).toBeNull();
    });
  });
});
