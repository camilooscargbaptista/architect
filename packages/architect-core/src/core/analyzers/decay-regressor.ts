/**
 * Decay Regressor — Weighted Linear Regression for Architecture Score Prediction
 *
 * Fits a weighted linear regression model on historical score data points
 * to predict future score decay. Uses exponential recency weighting so
 * recent trends matter more than old ones.
 *
 * Features:
 * - Weighted least-squares regression (recent weeks weighted higher)
 * - Confidence intervals based on residual variance
 * - R² goodness-of-fit metric
 * - Extrapolation with automatic confidence decay
 *
 * @since v9.0 — Fase 3.2
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/** A single data point: (weekOffset, score) */
export interface ScoreDataPoint {
  /** Weeks from the start of the analysis window (0 = oldest, N = most recent) */
  weekOffset: number;
  /** Architecture score at this point in time (0-100) */
  score: number;
  /** Optional weight override (default: auto-computed from recency) */
  weight?: number;
}

/** Result of a regression fit */
export interface RegressionResult {
  /** Slope of the regression line (negative = decay, positive = improvement) */
  slope: number;
  /** Intercept (predicted score at week 0) */
  intercept: number;
  /** R² goodness of fit (0-1, higher = better fit) */
  rSquared: number;
  /** Number of data points used */
  dataPoints: number;
  /** Standard error of the slope estimate */
  slopeStdError: number;
  /** Whether the trend is statistically significant (|t-stat| > 2) */
  isSignificant: boolean;
}

/** A prediction for a future time point */
export interface ScorePrediction {
  /** The week offset (relative to analysis start) being predicted */
  weekOffset: number;
  /** Predicted score (clamped to 0-100) */
  predictedScore: number;
  /** Lower bound of 95% confidence interval */
  lowerBound: number;
  /** Upper bound of 95% confidence interval */
  upperBound: number;
  /** Confidence in this prediction (0-1, decays with extrapolation distance) */
  confidence: number;
}

/** Complete decay forecast */
export interface DecayForecast {
  /** Current score (most recent data point) */
  currentScore: number;
  /** Predicted score at the horizon */
  predictedScore: number;
  /** Score change (negative = decay) */
  scoreDelta: number;
  /** Weekly rate of change */
  weeklyDelta: number;
  /** Weeks until score drops below threshold (Infinity if not projected to drop) */
  weeksToThreshold: number;
  /** The critical threshold used */
  threshold: number;
  /** Confidence in the overall forecast (0-1) */
  confidence: number;
  /** Underlying regression result */
  regression: RegressionResult;
  /** Predictions at each week in the horizon */
  trajectory: ScorePrediction[];
  /** Human-readable summary */
  summary: string;
}

export interface DecayRegressorConfig {
  /** Recency half-life in weeks: weight halves every N weeks going back (default: 8) */
  recencyHalfLife?: number;
  /** Forecast horizon in weeks (default: 12) */
  horizonWeeks?: number;
  /** Critical score threshold (default: 40) */
  criticalThreshold?: number;
  /** Minimum data points to attempt regression (default: 3) */
  minDataPoints?: number;
}

const DEFAULT_CONFIG: Required<DecayRegressorConfig> = {
  recencyHalfLife: 8,
  horizonWeeks: 12,
  criticalThreshold: 40,
  minDataPoints: 3,
};

// ═══════════════════════════════════════════════════════════════
// DECAY REGRESSOR
// ═══════════════════════════════════════════════════════════════

export class DecayRegressor {
  private config: Required<DecayRegressorConfig>;

  constructor(config?: DecayRegressorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Fit a weighted linear regression on score data and predict decay.
   *
   * @param data - Score data points ordered by time (oldest first)
   * @returns Decay forecast or null if insufficient data
   */
  forecast(data: ScoreDataPoint[]): DecayForecast | null {
    if (data.length < this.config.minDataPoints) return null;

    // 1. Apply recency weights
    const weighted = this.applyWeights(data);

    // 2. Fit weighted linear regression
    const regression = this.fitWeightedRegression(weighted);

    // 3. Generate trajectory predictions
    const lastWeek = data[data.length - 1]!.weekOffset;
    const trajectory = this.generateTrajectory(
      regression,
      lastWeek,
      lastWeek + this.config.horizonWeeks,
    );

    // 4. Compute decay metrics
    const currentScore = data[data.length - 1]!.score;
    const predictedScore = this.clampScore(
      regression.slope * (lastWeek + this.config.horizonWeeks) + regression.intercept
    );
    const scoreDelta = predictedScore - currentScore;
    const weeklyDelta = regression.slope;

    // 5. Weeks to threshold
    const weeksToThreshold = this.computeWeeksToThreshold(
      regression,
      lastWeek,
      currentScore,
    );

    // 6. Overall confidence
    const confidence = this.computeOverallConfidence(regression, data.length);

    // 7. Human-readable summary
    const summary = this.generateSummary(
      currentScore,
      predictedScore,
      scoreDelta,
      weeksToThreshold,
      confidence,
    );

    return {
      currentScore,
      predictedScore,
      scoreDelta: Math.round(scoreDelta * 10) / 10,
      weeklyDelta: Math.round(weeklyDelta * 100) / 100,
      weeksToThreshold,
      threshold: this.config.criticalThreshold,
      confidence: Math.round(confidence * 100) / 100,
      regression,
      trajectory,
      summary,
    };
  }

  // ── Weighted Regression ──────────────────────────────────────

  /**
   * Apply exponential recency weights to data points.
   * More recent weeks get higher weights.
   */
  applyWeights(data: ScoreDataPoint[]): ScoreDataPoint[] {
    if (data.length === 0) return [];

    const maxWeek = data[data.length - 1]!.weekOffset;
    const lambda = Math.LN2 / this.config.recencyHalfLife;

    return data.map(d => ({
      ...d,
      weight: d.weight ?? Math.exp(-lambda * (maxWeek - d.weekOffset)),
    }));
  }

  /**
   * Weighted least-squares linear regression.
   * Fits y = slope * x + intercept where x = weekOffset, y = score.
   */
  fitWeightedRegression(data: ScoreDataPoint[]): RegressionResult {
    const n = data.length;

    if (n === 0) {
      return { slope: 0, intercept: 0, rSquared: 0, dataPoints: 0, slopeStdError: 0, isSignificant: false };
    }

    if (n === 1) {
      return {
        slope: 0,
        intercept: data[0]!.score,
        rSquared: 1,
        dataPoints: 1,
        slopeStdError: Infinity,
        isSignificant: false,
      };
    }

    // Weighted sums
    let sumW = 0, sumWX = 0, sumWY = 0, sumWXX = 0, sumWXY = 0;

    for (const d of data) {
      const w = d.weight ?? 1;
      sumW += w;
      sumWX += w * d.weekOffset;
      sumWY += w * d.score;
      sumWXX += w * d.weekOffset * d.weekOffset;
      sumWXY += w * d.weekOffset * d.score;
    }

    const det = sumW * sumWXX - sumWX * sumWX;
    if (Math.abs(det) < 1e-10) {
      // Degenerate case: all x values identical
      return {
        slope: 0,
        intercept: sumWY / sumW,
        rSquared: 0,
        dataPoints: n,
        slopeStdError: Infinity,
        isSignificant: false,
      };
    }

    const slope = (sumW * sumWXY - sumWX * sumWY) / det;
    const intercept = (sumWXX * sumWY - sumWX * sumWXY) / det;

    // R² (coefficient of determination)
    const meanY = sumWY / sumW;
    let ssTot = 0, ssRes = 0;
    for (const d of data) {
      const w = d.weight ?? 1;
      const predicted = slope * d.weekOffset + intercept;
      ssTot += w * (d.score - meanY) ** 2;
      ssRes += w * (d.score - predicted) ** 2;
    }
    const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;

    // Standard error of slope
    const mse = ssRes / Math.max(n - 2, 1);
    const slopeStdError = Math.sqrt(mse * sumW / Math.max(det, 1e-10));

    // t-statistic for slope significance
    // Perfect fit (slopeStdError ≈ 0 with non-zero slope) = infinitely significant
    const tStat = slopeStdError > 1e-10 ? Math.abs(slope / slopeStdError) : (Math.abs(slope) > 1e-10 ? Infinity : 0);
    const isSignificant = tStat > 2;  // ~95% confidence

    return {
      slope: Math.round(slope * 1000) / 1000,
      intercept: Math.round(intercept * 100) / 100,
      rSquared: Math.round(rSquared * 1000) / 1000,
      dataPoints: n,
      slopeStdError: Math.round(slopeStdError * 1000) / 1000,
      isSignificant,
    };
  }

  // ── Trajectory Generation ───────────────────────────────────

  /**
   * Generate prediction trajectory from startWeek to endWeek.
   */
  generateTrajectory(
    regression: RegressionResult,
    startWeek: number,
    endWeek: number,
  ): ScorePrediction[] {
    const predictions: ScorePrediction[] = [];

    for (let week = startWeek + 1; week <= endWeek; week++) {
      const predicted = regression.slope * week + regression.intercept;
      const extrapolationDistance = week - startWeek;

      // Confidence decays with distance from last observed data
      const baseConfidence = regression.rSquared;
      const distanceDecay = Math.exp(-0.1 * extrapolationDistance);
      const confidence = Math.max(0.05, baseConfidence * distanceDecay);

      // Prediction interval width grows with distance
      const intervalWidth = regression.slopeStdError * extrapolationDistance * 1.96;

      predictions.push({
        weekOffset: week,
        predictedScore: this.clampScore(predicted),
        lowerBound: this.clampScore(predicted - intervalWidth),
        upperBound: this.clampScore(predicted + intervalWidth),
        confidence: Math.round(confidence * 100) / 100,
      });
    }

    return predictions;
  }

  // ── Threshold Analysis ──────────────────────────────────────

  /**
   * Compute weeks until score crosses the critical threshold.
   */
  private computeWeeksToThreshold(
    regression: RegressionResult,
    lastWeek: number,
    currentScore: number,
  ): number {
    // If slope >= 0, score is stable or improving
    if (regression.slope >= 0) return Infinity;

    // If already below threshold
    if (currentScore <= this.config.criticalThreshold) return 0;

    // y = slope * x + intercept = threshold
    // x = (threshold - intercept) / slope
    const thresholdWeek = (this.config.criticalThreshold - regression.intercept) / regression.slope;
    const weeksFromNow = thresholdWeek - lastWeek;

    return weeksFromNow > 0 ? Math.ceil(weeksFromNow) : 0;
  }

  // ── Confidence Computation ──────────────────────────────────

  private computeOverallConfidence(
    regression: RegressionResult,
    dataPointCount: number,
  ): number {
    // Base: R² quality of fit
    let confidence = regression.rSquared;

    // Bonus for more data points (max +0.2 at 24 points)
    confidence += Math.min(0.2, dataPointCount / 120);

    // Penalty for non-significant trends
    if (!regression.isSignificant) {
      confidence *= 0.5;
    }

    return Math.max(0.05, Math.min(0.95, confidence));
  }

  // ── Summary Generation ──────────────────────────────────────

  private generateSummary(
    currentScore: number,
    predictedScore: number,
    scoreDelta: number,
    weeksToThreshold: number,
    confidence: number,
  ): string {
    const roundedCurrent = Math.round(currentScore);
    const roundedPredicted = Math.round(predictedScore);
    const confidencePct = Math.round(confidence * 100);

    if (Math.abs(scoreDelta) < 1) {
      return `Score is projected to remain stable at ${roundedCurrent}/100 over the next ${this.config.horizonWeeks} weeks (${confidencePct}% confidence).`;
    }

    const direction = scoreDelta < 0 ? 'decline' : 'improve';
    const base = `Score is projected to ${direction} from ${roundedCurrent} to ${roundedPredicted} over the next ${this.config.horizonWeeks} weeks (${confidencePct}% confidence).`;

    if (weeksToThreshold !== Infinity && weeksToThreshold <= this.config.horizonWeeks * 2) {
      return `${base} Critical threshold (${this.config.criticalThreshold}) will be reached in approximately ${weeksToThreshold} weeks.`;
    }

    return base;
  }

  // ── Utils ───────────────────────────────────────────────────

  private clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
  }
}
