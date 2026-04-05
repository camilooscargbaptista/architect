/**
 * Tests for DecayRegressor — Fase 3.2
 *
 * Verifies weighted linear regression, prediction, and confidence intervals.
 */

import { DecayRegressor, ScoreDataPoint, RegressionResult } from '../src/core/analyzers/decay-regressor.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeData(scores: number[]): ScoreDataPoint[] {
  return scores.map((score, i) => ({ weekOffset: i, score }));
}

// ── Tests ────────────────────────────────────────────────────────

describe('DecayRegressor', () => {
  let regressor: DecayRegressor;

  beforeEach(() => {
    regressor = new DecayRegressor();
  });

  describe('forecast', () => {
    it('should return null for insufficient data', () => {
      const result = regressor.forecast([]);
      expect(result).toBeNull();
    });

    it('should return null for 1-2 data points (below minDataPoints=3)', () => {
      const r1 = regressor.forecast(makeData([80]));
      const r2 = regressor.forecast(makeData([80, 75]));
      expect(r1).toBeNull();
      expect(r2).toBeNull();
    });

    it('should produce a forecast with 3+ data points', () => {
      const result = regressor.forecast(makeData([80, 75, 70]));
      expect(result).not.toBeNull();
      expect(result!.currentScore).toBe(70);
      expect(result!.predictedScore).toBeLessThan(70);
      expect(result!.scoreDelta).toBeLessThan(0);
    });

    it('should detect declining trend with negative slope', () => {
      const result = regressor.forecast(makeData([90, 85, 80, 75, 70]));
      expect(result).not.toBeNull();
      expect(result!.regression.slope).toBeLessThan(0);
      expect(result!.scoreDelta).toBeLessThan(0);
    });

    it('should detect improving trend with positive slope', () => {
      const result = regressor.forecast(makeData([50, 55, 60, 65, 70]));
      expect(result).not.toBeNull();
      expect(result!.regression.slope).toBeGreaterThan(0);
      expect(result!.scoreDelta).toBeGreaterThan(0);
      expect(result!.weeksToThreshold).toBe(Infinity);
    });

    it('should detect stable scores', () => {
      const result = regressor.forecast(makeData([75, 75, 75, 75, 75]));
      expect(result).not.toBeNull();
      expect(Math.abs(result!.regression.slope)).toBeLessThan(0.5);
      expect(Math.abs(result!.scoreDelta)).toBeLessThan(2);
    });

    it('should calculate weeksToThreshold for declining scores', () => {
      // Score dropping from 60 to 50 in 5 weeks (about -2/week)
      const result = regressor.forecast(makeData([60, 58, 56, 54, 52, 50]));
      expect(result).not.toBeNull();
      // Should cross 40 eventually
      expect(result!.weeksToThreshold).toBeGreaterThan(0);
      expect(result!.weeksToThreshold).toBeLessThan(100);
    });

    it('should have trajectory with predictions for each week', () => {
      const result = regressor.forecast(makeData([80, 75, 70, 65, 60]));
      expect(result).not.toBeNull();
      expect(result!.trajectory.length).toBe(12); // default horizonWeeks
      for (const point of result!.trajectory) {
        expect(point.predictedScore).toBeGreaterThanOrEqual(0);
        expect(point.predictedScore).toBeLessThanOrEqual(100);
        expect(point.lowerBound).toBeLessThanOrEqual(point.predictedScore);
        expect(point.upperBound).toBeGreaterThanOrEqual(point.predictedScore);
        expect(point.confidence).toBeGreaterThan(0);
        expect(point.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should clamp predicted scores to [0, 100]', () => {
      // Extreme decline
      const result = regressor.forecast(makeData([20, 15, 10, 5, 3]));
      expect(result).not.toBeNull();
      expect(result!.predictedScore).toBeGreaterThanOrEqual(0);

      // Extreme improvement
      const result2 = regressor.forecast(makeData([80, 85, 90, 95, 98]));
      expect(result2).not.toBeNull();
      expect(result2!.predictedScore).toBeLessThanOrEqual(100);
    });

    it('should generate a human-readable summary', () => {
      const result = regressor.forecast(makeData([80, 75, 70, 65, 60]));
      expect(result).not.toBeNull();
      expect(result!.summary).toContain('decline');
      expect(result!.summary.length).toBeGreaterThan(20);
    });

    it('should use custom config', () => {
      const custom = new DecayRegressor({
        horizonWeeks: 24,
        criticalThreshold: 50,
        minDataPoints: 2,
      });
      const result = custom.forecast(makeData([80, 70]));
      expect(result).not.toBeNull();
      expect(result!.trajectory.length).toBe(24);
      expect(result!.threshold).toBe(50);
    });
  });

  describe('fitWeightedRegression', () => {
    it('should handle empty data', () => {
      const result = regressor.fitWeightedRegression([]);
      expect(result.slope).toBe(0);
      expect(result.dataPoints).toBe(0);
    });

    it('should handle single data point', () => {
      const result = regressor.fitWeightedRegression([
        { weekOffset: 5, score: 75, weight: 1 },
      ]);
      expect(result.slope).toBe(0);
      expect(result.intercept).toBe(75);
    });

    it('should fit a perfect linear decline', () => {
      const data = makeData([100, 90, 80, 70, 60]).map((d, _i) => ({
        ...d,
        weight: 1, // equal weights for perfect fit
      }));
      const result = regressor.fitWeightedRegression(data);
      expect(result.slope).toBeCloseTo(-10, 0);
      expect(result.rSquared).toBeCloseTo(1, 2);
      expect(result.isSignificant).toBe(true);
    });

    it('should report R² near 0 for random data', () => {
      const data: ScoreDataPoint[] = [
        { weekOffset: 0, score: 50, weight: 1 },
        { weekOffset: 1, score: 80, weight: 1 },
        { weekOffset: 2, score: 30, weight: 1 },
        { weekOffset: 3, score: 90, weight: 1 },
        { weekOffset: 4, score: 40, weight: 1 },
      ];
      const result = regressor.fitWeightedRegression(data);
      expect(result.rSquared).toBeLessThan(0.5);
    });
  });

  describe('applyWeights', () => {
    it('should give more weight to recent weeks', () => {
      const weighted = regressor.applyWeights(makeData([80, 75, 70, 65, 60]));
      // Last point should have highest weight
      const lastWeight = weighted[weighted.length - 1]!.weight!;
      const firstWeight = weighted[0]!.weight!;
      expect(lastWeight).toBeGreaterThan(firstWeight);
    });

    it('should set weight=1 for the most recent point', () => {
      const weighted = regressor.applyWeights(makeData([80, 70, 60]));
      expect(weighted[weighted.length - 1]!.weight).toBeCloseTo(1, 5);
    });

    it('should handle empty data', () => {
      expect(regressor.applyWeights([])).toEqual([]);
    });

    it('should respect user-provided weights', () => {
      const data: ScoreDataPoint[] = [
        { weekOffset: 0, score: 80, weight: 5 },
        { weekOffset: 1, score: 70, weight: 10 },
      ];
      const weighted = regressor.applyWeights(data);
      expect(weighted[0]!.weight).toBe(5);
      expect(weighted[1]!.weight).toBe(10);
    });
  });

  describe('generateTrajectory', () => {
    it('should generate correct number of predictions', () => {
      const regression: RegressionResult = {
        slope: -1,
        intercept: 80,
        rSquared: 0.9,
        dataPoints: 10,
        slopeStdError: 0.1,
        isSignificant: true,
      };
      const trajectory = regressor.generateTrajectory(regression, 10, 22);
      expect(trajectory).toHaveLength(12); // weeks 11 through 22
    });

    it('should have decreasing confidence with distance', () => {
      const regression: RegressionResult = {
        slope: -1,
        intercept: 80,
        rSquared: 0.8,
        dataPoints: 10,
        slopeStdError: 0.5,
        isSignificant: true,
      };
      const trajectory = regressor.generateTrajectory(regression, 0, 12);
      for (let i = 1; i < trajectory.length; i++) {
        expect(trajectory[i]!.confidence).toBeLessThanOrEqual(trajectory[i - 1]!.confidence);
      }
    });

    it('should have widening confidence intervals with distance', () => {
      const regression: RegressionResult = {
        slope: -2,
        intercept: 80,
        rSquared: 0.8,
        dataPoints: 10,
        slopeStdError: 0.5,
        isSignificant: true,
      };
      const trajectory = regressor.generateTrajectory(regression, 0, 12);
      for (let i = 1; i < trajectory.length; i++) {
        const prevWidth = trajectory[i - 1]!.upperBound - trajectory[i - 1]!.lowerBound;
        const currWidth = trajectory[i]!.upperBound - trajectory[i]!.lowerBound;
        expect(currWidth).toBeGreaterThanOrEqual(prevWidth - 0.1); // allow small rounding
      }
    });
  });
});
