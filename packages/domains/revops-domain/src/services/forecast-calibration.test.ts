import { describe, expect, it } from 'vitest';
import {
  ForecastCalibration,
  type ForecastActualPair,
} from './forecast-calibration.js';

function buildHistory(
  pairs: Array<{ forecasted: number; actual: number }>,
): ForecastActualPair[] {
  return pairs.map((p, i) => ({
    period: `2025-Q${i + 1}`,
    forecastedValue: p.forecasted,
    actualValue: p.actual,
  }));
}

describe('ForecastCalibration', () => {
  const calibration = new ForecastCalibration();

  describe('computeMetrics', () => {
    it('returns zero metrics for empty history', () => {
      const metrics = calibration.computeMetrics([]);
      expect(metrics).toEqual({ mape: 0, bias: 0, sampleSize: 0 });
    });

    it('computes perfect metrics when forecast equals actual', () => {
      const metrics = calibration.computeMetrics(
        buildHistory([
          { forecasted: 100_000, actual: 100_000 },
          { forecasted: 200_000, actual: 200_000 },
        ]),
      );
      expect(metrics.mape).toBe(0);
      expect(metrics.bias).toBe(0);
      expect(metrics.sampleSize).toBe(2);
    });

    it('computes MAPE and positive bias for over-forecasting', () => {
      const metrics = calibration.computeMetrics(
        buildHistory([
          { forecasted: 120_000, actual: 100_000 },
          { forecasted: 180_000, actual: 150_000 },
        ]),
      );
      // errors: +20k (20%), +30k (20%) → MAPE = 20%
      expect(metrics.mape).toBe(20);
      // bias: (20k + 30k) / 2 = 25k
      expect(metrics.bias).toBe(25_000);
    });

    it('computes negative bias for under-forecasting', () => {
      const metrics = calibration.computeMetrics(
        buildHistory([
          { forecasted: 80_000, actual: 100_000 },
          { forecasted: 140_000, actual: 160_000 },
        ]),
      );
      expect(metrics.bias).toBeLessThan(0);
    });
  });

  describe('computeConfidenceBand', () => {
    it('returns default +/- 20% band with insufficient data', () => {
      const band = calibration.computeConfidenceBand(100_000, []);
      expect(band.low).toBe(80_000);
      expect(band.mid).toBe(100_000);
      expect(band.high).toBe(120_000);
      expect(band.confidenceLevel).toBe(0.8);
    });

    it('computes data-driven bands from historical ratios', () => {
      const history = buildHistory([
        { forecasted: 100_000, actual: 90_000 }, // ratio 0.9
        { forecasted: 100_000, actual: 110_000 }, // ratio 1.1
        { forecasted: 100_000, actual: 95_000 }, // ratio 0.95
        { forecasted: 100_000, actual: 105_000 }, // ratio 1.05
      ]);

      const band = calibration.computeConfidenceBand(200_000, history);
      expect(band.mid).toBe(200_000);
      // Band should be narrower than default since history shows ±10% variance
      expect(band.low).toBeGreaterThan(200_000 * 0.8);
      expect(band.high).toBeLessThan(200_000 * 1.2);
      expect(band.low).toBeLessThan(band.mid);
      expect(band.high).toBeGreaterThan(band.mid);
    });

    it('widens bands with volatile history', () => {
      const history = buildHistory([
        { forecasted: 100_000, actual: 50_000 }, // ratio 0.5
        { forecasted: 100_000, actual: 150_000 }, // ratio 1.5
        { forecasted: 100_000, actual: 60_000 }, // ratio 0.6
        { forecasted: 100_000, actual: 140_000 }, // ratio 1.4
      ]);

      const band = calibration.computeConfidenceBand(200_000, history);
      // Should be much wider
      expect(band.high - band.low).toBeGreaterThan(100_000);
    });
  });

  describe('evaluateAlerts', () => {
    it('returns no actionable alerts for excellent accuracy', () => {
      const alerts = calibration.evaluateAlerts(
        { mape: 5, bias: 1000, sampleSize: 8 },
        { low: 90_000, mid: 100_000, high: 110_000, confidenceLevel: 0.8 },
      );
      // Only non-actionable alerts (e.g., no mape or bias alerts)
      const actionable = alerts.filter((a) => a.severity !== 'info');
      expect(actionable).toHaveLength(0);
    });

    it('returns critical alert for very poor MAPE', () => {
      const alerts = calibration.evaluateAlerts(
        { mape: 50, bias: 0, sampleSize: 5 },
        { low: 50_000, mid: 100_000, high: 150_000, confidenceLevel: 0.8 },
      );
      const critical = alerts.filter((a) => a.severity === 'critical');
      expect(critical.length).toBeGreaterThan(0);
      expect(critical[0].title).toContain('accuracy');
    });

    it('returns warning for moderate MAPE', () => {
      const alerts = calibration.evaluateAlerts(
        { mape: 25, bias: 0, sampleSize: 5 },
        { low: 75_000, mid: 100_000, high: 125_000, confidenceLevel: 0.8 },
      );
      const warnings = alerts.filter((a) => a.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('alerts on systematic over-forecasting bias', () => {
      const alerts = calibration.evaluateAlerts(
        { mape: 15, bias: 40_000, sampleSize: 4 },
        { low: 80_000, mid: 100_000, high: 120_000, confidenceLevel: 0.8 },
      );
      const biasAlert = alerts.find((a) => a.title.includes('over-forecasting'));
      expect(biasAlert).toBeDefined();
    });

    it('includes info alert for limited data', () => {
      const alerts = calibration.evaluateAlerts(
        { mape: 10, bias: 0, sampleSize: 2 },
        { low: 80_000, mid: 100_000, high: 120_000, confidenceLevel: 0.8 },
      );
      const info = alerts.find(
        (a) => a.severity === 'info' && a.title.includes('Limited'),
      );
      expect(info).toBeDefined();
    });
  });

  describe('calibrate (integration)', () => {
    it('produces full calibration report', () => {
      const history = buildHistory([
        { forecasted: 100_000, actual: 95_000 },
        { forecasted: 150_000, actual: 130_000 },
        { forecasted: 120_000, actual: 125_000 },
        { forecasted: 180_000, actual: 170_000 },
      ]);

      const report = calibration.calibrate(200_000, history);

      expect(report.metrics.sampleSize).toBe(4);
      expect(report.metrics.mape).toBeGreaterThan(0);
      expect(report.confidenceBand.mid).toBe(200_000);
      expect(report.confidenceBand.low).toBeLessThan(200_000);
      expect(report.confidenceBand.high).toBeGreaterThanOrEqual(200_000);
      expect(Array.isArray(report.alerts)).toBe(true);
    });
  });
});
