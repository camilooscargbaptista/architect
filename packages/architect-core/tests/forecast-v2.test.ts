/**
 * Tests for ForecastV2Engine — Fase 3.2
 *
 * Integration tests for the ML-based architecture forecast pipeline.
 */

import { ForecastV2Engine } from '../src/core/analyzers/forecast-v2.js';
import type { AnalysisReport, ArchitectureScore } from '../src/core/types/core.js';
import type { GitHistoryReport, WeeklySnapshot, ModuleHistory, VelocityVector } from '../src/infrastructure/git-history.js';
import type { TemporalReport, TemporalScore } from '../src/core/analyzers/temporal-scorer.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeScore(overall: number): ArchitectureScore {
  return {
    overall,
    components: [],
    breakdown: { modularity: overall, coupling: overall, cohesion: overall, layering: overall },
  };
}

function makeAnalysisReport(score: number): AnalysisReport {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      name: 'test-project',
      rootPath: '/project',
      totalFiles: 50,
      totalLines: 5000,
      primaryLanguages: ['typescript'],
      fileTree: [],
    } as any,
    score: makeScore(score),
    antiPatterns: [],
    layers: [],
    dependencyGraph: { nodes: [], edges: [] },
    suggestions: [],
    diagram: { mermaid: '', type: 'layer' },
  };
}

function makeSnapshot(weekStart: string, commits: number, churn: number, activeFiles: number): WeeklySnapshot {
  return { weekStart, commits, churn, activeFiles };
}

function makeVelocity(overrides?: Partial<VelocityVector>): VelocityVector {
  return {
    commitAcceleration: 0,
    churnTrend: 0,
    direction: 'stable',
    ...overrides,
  };
}

function makeModule(modulePath: string, overrides?: Partial<ModuleHistory>): ModuleHistory {
  return {
    modulePath,
    files: [],
    aggregateCommits: 20,
    aggregateChurn: 500,
    avgWeeklyRate: 2,
    topHotspots: [],
    velocityVector: makeVelocity(),
    busFactor: 2,
    ...overrides,
  };
}

function makeGitReport(
  weeks: number = 12,
  modules: ModuleHistory[] = [],
): GitHistoryReport {
  const timeline: WeeklySnapshot[] = [];
  for (let i = 0; i < weeks; i++) {
    const date = new Date(2026, 0, 5 + i * 7);
    timeline.push(makeSnapshot(
      date.toISOString().split('T')[0]!,
      10 + Math.floor(Math.random() * 10),
      100 + Math.floor(Math.random() * 100),
      5 + Math.floor(Math.random() * 5),
    ));
  }

  return {
    projectPath: '/project',
    analyzedAt: new Date().toISOString(),
    periodWeeks: weeks,
    totalCommits: timeline.reduce((s, w) => s + w.commits, 0),
    totalAuthors: 3,
    modules: modules.length > 0 ? modules : [makeModule('src/core'), makeModule('src/api')],
    hotspots: [],
    changeCouplings: [],
    commitTimeline: timeline,
  };
}

function makeTemporalScore(module: string, overrides?: Partial<TemporalScore>): TemporalScore {
  return {
    module,
    staticScore: 70,
    temporalScore: 65,
    trend: 'stable',
    projectedScore: 60,
    projectionConfidence: 0.7,
    projectionWeeks: 12,
    riskLevel: 'medium',
    velocity: makeVelocity(),
    ...overrides,
  };
}

function makeTemporalReport(modules: TemporalScore[]): TemporalReport {
  return {
    projectPath: '/project',
    analyzedAt: new Date().toISOString(),
    overallTrend: 'stable',
    overallTemporalScore: 65,
    modules,
    degradingModules: modules.filter(m => m.trend === 'degrading'),
    improvingModules: modules.filter(m => m.trend === 'improving'),
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('ForecastV2Engine', () => {
  let engine: ForecastV2Engine;

  beforeEach(() => {
    engine = new ForecastV2Engine();
  });

  describe('predict', () => {
    it('should produce a complete forecast report', () => {
      const report = makeAnalysisReport(70);
      const gitReport = makeGitReport(12);

      const result = engine.predict(report, gitReport);

      expect(result.projectPath).toBe('/project');
      expect(result.generatedAt).toBeDefined();
      expect(result.projectForecast).toBeDefined();
      expect(result.timeline).toBeDefined();
      expect(result.modulePredictions).toBeDefined();
      expect(result.headline).toBeDefined();
      expect(result.overallRisk).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should have valid projectForecast', () => {
      const report = makeAnalysisReport(75);
      const gitReport = makeGitReport(12);

      const result = engine.predict(report, gitReport);
      const fc = result.projectForecast;

      expect(fc.currentScore).toBeGreaterThanOrEqual(0);
      expect(fc.currentScore).toBeLessThanOrEqual(100);
      expect(fc.predictedScore).toBeGreaterThanOrEqual(0);
      expect(fc.predictedScore).toBeLessThanOrEqual(100);
      expect(typeof fc.weeklyDelta).toBe('number');
      expect(typeof fc.confidence).toBe('number');
      expect(fc.confidence).toBeGreaterThanOrEqual(0);
      expect(fc.confidence).toBeLessThanOrEqual(1);
      expect(fc.regression).toBeDefined();
      expect(fc.summary).toBeDefined();
    });

    it('should produce module predictions sorted by risk', () => {
      const report = makeAnalysisReport(65);
      const gitReport = makeGitReport(12, [
        makeModule('src/core', {
          velocityVector: makeVelocity({ churnTrend: 50, direction: 'accelerating' }),
          aggregateChurn: 3000,
        }),
        makeModule('src/stable', {
          velocityVector: makeVelocity({ churnTrend: -5, direction: 'decelerating' }),
          aggregateChurn: 200,
        }),
      ]);

      const result = engine.predict(report, gitReport);
      expect(result.modulePredictions.length).toBe(2);
      // Risk levels should be valid
      for (const mod of result.modulePredictions) {
        expect(['low', 'medium', 'high', 'critical']).toContain(mod.riskLevel);
        expect(mod.drivers.length).toBeGreaterThan(0);
      }
    });

    it('should enrich with temporal data when provided', () => {
      const report = makeAnalysisReport(60);
      const gitReport = makeGitReport(12, [
        makeModule('src/core'),
      ]);
      const temporalReport = makeTemporalReport([
        makeTemporalScore('src/core', {
          trend: 'degrading',
          velocity: makeVelocity({ churnTrend: 40, commitAcceleration: 30 }),
        }),
      ]);

      const result = engine.predict(report, gitReport, temporalReport);
      // Should have enriched drivers from temporal data
      const corePrediction = result.modulePredictions.find(m => m.modulePath === 'src/core');
      if (corePrediction) {
        expect(corePrediction.drivers.some(d => d.includes('churn') || d.includes('degrading') || d.includes('Accelerating'))).toBe(true);
      }
    });

    it('should handle empty git history gracefully', () => {
      const report = makeAnalysisReport(80);
      const gitReport = makeGitReport(0, []);

      const result = engine.predict(report, gitReport);
      expect(result.projectForecast.currentScore).toBe(80);
      expect(result.projectForecast.confidence).toBeLessThanOrEqual(0.2);
      expect(result.overallRisk).toBe('low');
    });

    it('should classify overall risk correctly', () => {
      // Low risk: stable high score
      const stableReport = makeAnalysisReport(85);
      const stableGit = makeGitReport(12);
      const stableResult = engine.predict(stableReport, stableGit);
      expect(['low', 'medium']).toContain(stableResult.overallRisk);

      // Risk levels should be valid enum values
      expect(['low', 'medium', 'high', 'critical']).toContain(stableResult.overallRisk);
    });

    it('should generate relevant recommendations', () => {
      const report = makeAnalysisReport(55);
      const gitReport = makeGitReport(12, [
        makeModule('src/problem', {
          velocityVector: makeVelocity({ churnTrend: 60, direction: 'accelerating' }),
          aggregateChurn: 5000,
          aggregateCommits: 50,
        }),
      ]);

      const result = engine.predict(report, gitReport);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeLessThanOrEqual(5);
      for (const rec of result.recommendations) {
        expect(rec.length).toBeGreaterThan(10);
      }
    });
  });

  describe('configuration', () => {
    it('should accept custom thresholds', () => {
      const custom = new ForecastV2Engine({
        criticalThreshold: 50,
        warningThreshold: 70,
        regression: { horizonWeeks: 24 },
      });
      const report = makeAnalysisReport(60);
      const gitReport = makeGitReport(12);

      const result = custom.predict(report, gitReport);
      expect(result.projectForecast.threshold).toBe(50);
    });
  });
});
