/**
 * Forecast Calibration Service
 *
 * Compares historical forecasts against actual outcomes to produce
 * accuracy metrics, confidence bands, and risk alerts.
 * Pure domain logic — no infrastructure dependencies.
 */

export interface ForecastActualPair {
  period: string;
  forecastedValue: number;
  actualValue: number;
}

export interface CalibrationMetrics {
  /** Mean Absolute Percentage Error (0-100+). Lower is better. */
  mape: number;
  /** Systematic over/under-prediction. Positive = over-forecast, negative = under-forecast. */
  bias: number;
  /** Number of historical periods analyzed. */
  sampleSize: number;
}

export interface ConfidenceBand {
  /** Lower bound of the confidence interval. */
  low: number;
  /** Central (weighted) forecast value. */
  mid: number;
  /** Upper bound of the confidence interval. */
  high: number;
  /** Confidence level (e.g. 0.8 for 80%). */
  confidenceLevel: number;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RiskAlert {
  severity: AlertSeverity;
  title: string;
  description: string;
}

export interface CalibrationReport {
  metrics: CalibrationMetrics;
  confidenceBand: ConfidenceBand;
  alerts: RiskAlert[];
}

export class ForecastCalibration {
  /**
   * Produce a full calibration report for a current forecast given historical data.
   *
   * @param currentForecast - The weighted forecast value for the active period.
   * @param history - Past forecast-vs-actual pairs (at least 2 recommended).
   */
  calibrate(
    currentForecast: number,
    history: ForecastActualPair[],
  ): CalibrationReport {
    const metrics = this.computeMetrics(history);
    const confidenceBand = this.computeConfidenceBand(
      currentForecast,
      history,
    );
    const alerts = this.evaluateAlerts(metrics, confidenceBand);

    return { metrics, confidenceBand, alerts };
  }

  computeMetrics(history: ForecastActualPair[]): CalibrationMetrics {
    if (history.length === 0) {
      return { mape: 0, bias: 0, sampleSize: 0 };
    }

    let totalAbsPercentError = 0;
    let totalSignedError = 0;

    for (const pair of history) {
      const actual = Math.max(1, pair.actualValue); // avoid division by zero
      const error = pair.forecastedValue - pair.actualValue;
      totalAbsPercentError += Math.abs(error / actual) * 100;
      totalSignedError += error;
    }

    const n = history.length;
    return {
      mape: round(totalAbsPercentError / n),
      bias: round(totalSignedError / n),
      sampleSize: n,
    };
  }

  computeConfidenceBand(
    currentForecast: number,
    history: ForecastActualPair[],
    confidenceLevel = 0.8,
  ): ConfidenceBand {
    if (history.length < 2) {
      // Not enough data for meaningful bands — return +/- 20% default
      return {
        low: round(currentForecast * 0.8),
        mid: round(currentForecast),
        high: round(currentForecast * 1.2),
        confidenceLevel,
      };
    }

    // Compute error ratios (actual / forecasted) for each historical period
    const ratios = history
      .filter((p) => p.forecastedValue > 0)
      .map((p) => p.actualValue / p.forecastedValue);

    if (ratios.length < 2) {
      return {
        low: round(currentForecast * 0.8),
        mid: round(currentForecast),
        high: round(currentForecast * 1.2),
        confidenceLevel,
      };
    }

    ratios.sort((a, b) => a - b);

    // Use percentile-based intervals for the given confidence level
    const trimPct = (1 - confidenceLevel) / 2;
    const lowIdx = Math.floor(trimPct * ratios.length);
    const highIdx = Math.min(
      ratios.length - 1,
      Math.ceil((1 - trimPct) * ratios.length) - 1,
    );

    const lowRatio = ratios[lowIdx];
    const highRatio = ratios[highIdx];

    return {
      low: round(currentForecast * lowRatio),
      mid: round(currentForecast),
      high: round(currentForecast * highRatio),
      confidenceLevel,
    };
  }

  evaluateAlerts(
    metrics: CalibrationMetrics,
    band: ConfidenceBand,
  ): RiskAlert[] {
    const alerts: RiskAlert[] = [];

    // MAPE-based alerts
    if (metrics.mape >= 40) {
      alerts.push({
        severity: 'critical',
        title: 'Forecast accuracy is poor',
        description: `MAPE is ${metrics.mape}% — forecasts are off by nearly half. Historical data suggests low predictability.`,
      });
    } else if (metrics.mape >= 20) {
      alerts.push({
        severity: 'warning',
        title: 'Forecast accuracy needs improvement',
        description: `MAPE is ${metrics.mape}% — consider reviewing pipeline stage probabilities and deal aging.`,
      });
    }

    // Bias-based alerts
    const absBias = Math.abs(metrics.bias);
    if (metrics.sampleSize >= 2 && absBias > 0) {
      const direction =
        metrics.bias > 0 ? 'over-forecasting' : 'under-forecasting';
      if (absBias >= band.mid * 0.3) {
        alerts.push({
          severity: 'critical',
          title: `Systematic ${direction}`,
          description: `Average bias is ${metrics.bias > 0 ? '+' : ''}${metrics.bias}. Adjust weighting or commit criteria.`,
        });
      } else if (absBias >= band.mid * 0.1) {
        alerts.push({
          severity: 'warning',
          title: `Trending towards ${direction}`,
          description: `Average bias is ${metrics.bias > 0 ? '+' : ''}${metrics.bias}. Monitor next period for drift.`,
        });
      }
    }

    // Insufficient data
    if (metrics.sampleSize < 3) {
      alerts.push({
        severity: 'info',
        title: 'Limited calibration data',
        description: `Only ${metrics.sampleSize} historical period(s) available. Confidence bands may be unreliable.`,
      });
    }

    return alerts.sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    });
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
