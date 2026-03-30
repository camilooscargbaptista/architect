/**
 * Tests for TemporalScorer
 *
 * Validates trend classification, temporal score penalties,
 * projection, risk levels, and overall trend aggregation.
 */

import { TemporalScorer } from '../src/core/analyzers/temporal-scorer.js';
import type { TemporalReport, TemporalScore } from '../src/core/analyzers/temporal-scorer.js';
import type {
  GitHistoryReport,
  ModuleHistory,
  VelocityVector,
  FileHistory,
} from '../src/infrastructure/git-history.js';

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

function makeFileHistory(overrides: Partial<FileHistory> = {}): FileHistory {
  return {
    path: 'test.ts',
    commits: 10,
    totalAdditions: 200,
    totalDeletions: 50,
    churnRate: 25,
    authors: new Set(['alice']),
    busFactor: 1,
    lastModified: new Date(),
    weeklyCommitRate: 2,
    isHotspot: false,
    ...overrides,
  };
}

function makeVelocity(overrides: Partial<VelocityVector> = {}): VelocityVector {
  return {
    commitAcceleration: 0,
    churnTrend: 0,
    direction: 'stable',
    ...overrides,
  };
}

function makeModule(
  modulePath: string,
  velocity: Partial<VelocityVector> = {},
  overrides: Partial<ModuleHistory> = {},
): ModuleHistory {
  const files = overrides.files ?? [makeFileHistory()];
  return {
    modulePath,
    files,
    aggregateCommits: files.reduce((s, f) => s + f.commits, 0),
    aggregateChurn: files.reduce((s, f) => s + f.totalAdditions + f.totalDeletions, 0),
    avgWeeklyRate: 2,
    topHotspots: [],
    velocityVector: makeVelocity(velocity),
    busFactor: 2,
    ...overrides,
  };
}

function makeGitReport(modules: ModuleHistory[]): GitHistoryReport {
  return {
    projectPath: '/test',
    analyzedAt: new Date().toISOString(),
    periodWeeks: 24,
    totalCommits: 100,
    totalAuthors: 5,
    modules,
    hotspots: [],
    changeCouplings: [],
    commitTimeline: [],
  };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('TemporalScorer', () => {
  describe('score()', () => {
    it('should score all modules from git report', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src'), makeModule('lib')];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 80], ['lib', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules.length).toBe(2);
      expect(report.projectPath).toBe('/test');
      expect(report.analyzedAt).toBeDefined();
    });

    it('should infer static score when not provided', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('unknown-module')];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map<string, number>(); // empty

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].staticScore).toBeGreaterThan(0);
    });

    it('should sort modules by temporal score ascending (worst first)', () => {
      const scorer = new TemporalScorer();
      const modules = [
        makeModule('good', { churnTrend: -20, direction: 'decelerating' }),
        makeModule('bad', { churnTrend: 50, commitAcceleration: 60, direction: 'accelerating' }),
      ];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['good', 80], ['bad', 80]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].temporalScore).toBeLessThanOrEqual(report.modules[1].temporalScore);
    });
  });

  describe('trend classification', () => {
    it('should classify degrading when churn trend is high', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: 40, commitAcceleration: 10, direction: 'stable' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].trend).toBe('degrading');
    });

    it('should classify degrading when commit acceleration is very high', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: 5, commitAcceleration: 60, direction: 'accelerating' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].trend).toBe('degrading');
    });

    it('should classify improving when churn is decreasing', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: -15, commitAcceleration: 0, direction: 'stable' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].trend).toBe('improving');
    });

    it('should classify stable for moderate metrics', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: 5, commitAcceleration: 5, direction: 'stable' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].trend).toBe('stable');
    });
  });

  describe('temporal score calculation', () => {
    it('should penalize degrading modules', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: 50, commitAcceleration: 30, direction: 'accelerating' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 80]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].temporalScore).toBeLessThan(80);
    });

    it('should give slight bonus for improving modules', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: -50, commitAcceleration: -10, direction: 'decelerating' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 70]]);

      const report = scorer.score(gitReport, staticScores);

      // The bonus comes from negative churn penalty
      expect(report.modules[0].temporalScore).toBeGreaterThanOrEqual(70);
    });

    it('should clamp temporal score between 0 and 100', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: 500, commitAcceleration: 200, direction: 'accelerating' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 10]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].temporalScore).toBeGreaterThanOrEqual(0);
      expect(report.modules[0].temporalScore).toBeLessThanOrEqual(100);
    });
  });

  describe('risk classification', () => {
    it('should classify critical for very low scores', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: 100, commitAcceleration: 80, direction: 'accelerating' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 25]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].riskLevel).toBe('critical');
    });

    it('should classify low for healthy modules', () => {
      const scorer = new TemporalScorer();
      const modules = [makeModule('src', { churnTrend: -5, commitAcceleration: 0, direction: 'stable' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 85]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].riskLevel).toBe('low');
    });
  });

  describe('projection', () => {
    it('should project future score', () => {
      const scorer = new TemporalScorer({ projectionWeeks: 12 });
      const modules = [makeModule('src', { churnTrend: 30, commitAcceleration: 10, direction: 'stable' })];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['src', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.modules[0].projectedScore).toBeDefined();
      expect(report.modules[0].projectionWeeks).toBe(12);
      expect(report.modules[0].projectionConfidence).toBeGreaterThan(0);
      expect(report.modules[0].projectionConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('overall trend', () => {
    it('should return degrading when >30% modules are degrading', () => {
      const scorer = new TemporalScorer();
      const modules = [
        makeModule('a', { churnTrend: 50, direction: 'accelerating' }),
        makeModule('b', { churnTrend: 50, direction: 'accelerating' }),
        makeModule('c', { churnTrend: 0, direction: 'stable' }),
      ];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['a', 70], ['b', 70], ['c', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.overallTrend).toBe('degrading');
    });

    it('should return improving when >30% modules are improving', () => {
      const scorer = new TemporalScorer();
      const modules = [
        makeModule('a', { churnTrend: -20, commitAcceleration: 0, direction: 'stable' }),
        makeModule('b', { churnTrend: -20, commitAcceleration: 0, direction: 'stable' }),
        makeModule('c', { churnTrend: 0, direction: 'stable' }),
      ];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['a', 70], ['b', 70], ['c', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.overallTrend).toBe('improving');
    });

    it('should return stable for empty modules', () => {
      const scorer = new TemporalScorer();
      const gitReport = makeGitReport([]);
      const staticScores = new Map<string, number>();

      const report = scorer.score(gitReport, staticScores);

      expect(report.overallTrend).toBe('stable');
      expect(report.overallTemporalScore).toBe(0);
    });
  });

  describe('degrading/improving lists', () => {
    it('should separate degrading and improving modules', () => {
      const scorer = new TemporalScorer();
      const modules = [
        makeModule('bad', { churnTrend: 50, direction: 'accelerating' }),
        makeModule('good', { churnTrend: -20, commitAcceleration: 0, direction: 'decelerating' }),
        makeModule('ok', { churnTrend: 0, direction: 'stable' }),
      ];
      const gitReport = makeGitReport(modules);
      const staticScores = new Map([['bad', 70], ['good', 70], ['ok', 70]]);

      const report = scorer.score(gitReport, staticScores);

      expect(report.degradingModules.some(m => m.module === 'bad')).toBe(true);
      expect(report.improvingModules.some(m => m.module === 'good')).toBe(true);
    });
  });
});
