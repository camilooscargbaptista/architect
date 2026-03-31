/**
 * Tests for ForecastEngine
 *
 * Validates pre-anti-pattern detection, module forecasts,
 * outlook classification, and recommendation generation.
 */

import { ForecastEngine } from '../src/core/analyzers/forecast.js';
import type {
  GitHistoryReport,
  ModuleHistory,
  VelocityVector,
  FileHistory,
  ChangeCoupling,
} from '../src/infrastructure/git-history.js';
import type { TemporalReport, TemporalScore } from '../src/core/analyzers/temporal-scorer.js';

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

function makeVelocity(overrides: Partial<VelocityVector> = {}): VelocityVector {
  return {
    commitAcceleration: 0,
    churnTrend: 0,
    direction: 'stable',
    ...overrides,
  };
}

function makeFileHistory(overrides: Partial<FileHistory> = {}): FileHistory {
  return {
    path: 'src/test.ts',
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

function makeModule(
  modulePath: string,
  velocity: Partial<VelocityVector> = {},
  overrides: Partial<ModuleHistory> = {},
): ModuleHistory {
  const files = overrides.files ?? [makeFileHistory({ path: `${modulePath}/file.ts` })];
  return {
    modulePath,
    files,
    aggregateCommits: overrides.aggregateCommits ?? 20,
    aggregateChurn: overrides.aggregateChurn ?? 500,
    avgWeeklyRate: 2,
    topHotspots: [],
    velocityVector: makeVelocity(velocity),
    busFactor: overrides.busFactor ?? 2,
    ...overrides,
  };
}

function makeTemporalScore(
  module: string,
  overrides: Partial<TemporalScore> = {},
): TemporalScore {
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

function makeGitReport(
  modules: ModuleHistory[],
  couplings: ChangeCoupling[] = [],
): GitHistoryReport {
  return {
    projectPath: '/test',
    analyzedAt: new Date().toISOString(),
    periodWeeks: 24,
    totalCommits: 100,
    totalAuthors: 5,
    modules,
    hotspots: [],
    changeCouplings: couplings,
    commitTimeline: [],
  };
}

function makeTemporalReport(
  modules: TemporalScore[],
  overrides: Partial<TemporalReport> = {},
): TemporalReport {
  return {
    projectPath: '/test',
    analyzedAt: new Date().toISOString(),
    overallTrend: 'stable',
    overallTemporalScore: 70,
    modules,
    degradingModules: modules.filter(m => m.trend === 'degrading'),
    improvingModules: modules.filter(m => m.trend === 'improving'),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('ForecastEngine', () => {
  describe('forecast()', () => {
    it('should return a well-formed forecast', () => {
      const engine = new ForecastEngine();
      const mod = makeModule('src');
      const ts = makeTemporalScore('src');
      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      expect(forecast.projectPath).toBe('/test');
      expect(forecast.generatedAt).toBeDefined();
      expect(forecast.overallOutlook).toMatch(/^(sunny|cloudy|stormy)$/);
      expect(forecast.headline).toBeDefined();
      expect(forecast.modules).toHaveLength(1);
      expect(forecast.topRisks).toBeDefined();
      expect(forecast.recommendations).toBeDefined();
    });

    it('should handle empty modules', () => {
      const engine = new ForecastEngine();
      const gitReport = makeGitReport([]);
      const temporalReport = makeTemporalReport([]);

      const forecast = engine.forecast(gitReport, temporalReport);

      expect(forecast.modules).toHaveLength(0);
      expect(forecast.overallOutlook).toBe('sunny');
    });
  });

  describe('pre-anti-pattern: emerging-god-class', () => {
    it('should detect god class when churn rate is high and growing', () => {
      const engine = new ForecastEngine({ godClassChurnThreshold: 100 });

      const file = makeFileHistory({
        path: 'src/big.ts',
        churnRate: 160, // above threshold
        commits: 20,
      });
      const mod = makeModule('src', { churnTrend: 40, direction: 'accelerating' }, { files: [file] });
      const ts = makeTemporalScore('src', {
        velocity: makeVelocity({ churnTrend: 40, direction: 'accelerating' }),
      });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const godClass = forecast.preAntiPatterns.filter(p => p.type === 'emerging-god-class');
      expect(godClass.length).toBeGreaterThanOrEqual(1);
      expect(godClass[0].module).toBe('src');
    });

    it('should NOT detect god class when churn is below threshold', () => {
      const engine = new ForecastEngine({ godClassChurnThreshold: 200 });

      const file = makeFileHistory({ path: 'src/small.ts', churnRate: 50 });
      const mod = makeModule('src', { churnTrend: 10 }, { files: [file] });
      const ts = makeTemporalScore('src', {
        velocity: makeVelocity({ churnTrend: 10 }),
      });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const godClass = forecast.preAntiPatterns.filter(p => p.type === 'emerging-god-class');
      expect(godClass.length).toBe(0);
    });
  });

  describe('pre-anti-pattern: emerging-shotgun-surgery', () => {
    it('should detect shotgun surgery when many files are coupled', () => {
      const engine = new ForecastEngine({ shotgunCouplingThreshold: 3 });

      const mod = makeModule('src');
      const ts = makeTemporalScore('src');

      // Create 5 couplings involving src/
      const couplings: ChangeCoupling[] = [];
      for (let i = 0; i < 5; i++) {
        couplings.push({
          fileA: `src/file${i}.ts`,
          fileB: `lib/dep${i}.ts`,
          cochangeCount: 5,
          confidence: 0.7,
        });
      }

      const gitReport = makeGitReport([mod], couplings);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const shotgun = forecast.preAntiPatterns.filter(p => p.type === 'emerging-shotgun-surgery');
      expect(shotgun.length).toBe(1);
      expect(shotgun[0].module).toBe('src');
    });

    it('should NOT detect shotgun when coupling count is below threshold', () => {
      const engine = new ForecastEngine({ shotgunCouplingThreshold: 10 });

      const mod = makeModule('src');
      const ts = makeTemporalScore('src');
      const couplings: ChangeCoupling[] = [{
        fileA: 'src/a.ts',
        fileB: 'lib/b.ts',
        cochangeCount: 3,
        confidence: 0.5,
      }];

      const gitReport = makeGitReport([mod], couplings);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const shotgun = forecast.preAntiPatterns.filter(p => p.type === 'emerging-shotgun-surgery');
      expect(shotgun.length).toBe(0);
    });
  });

  describe('pre-anti-pattern: bus-factor-risk', () => {
    it('should detect bus factor risk for single-contributor modules', () => {
      const engine = new ForecastEngine({ busFatorRiskThreshold: 1 });

      const mod = makeModule('src', {}, { busFactor: 1, aggregateCommits: 10 });
      const ts = makeTemporalScore('src');

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const busRisk = forecast.preAntiPatterns.filter(p => p.type === 'bus-factor-risk');
      expect(busRisk.length).toBe(1);
    });

    it('should NOT flag bus factor risk for multi-contributor modules', () => {
      const engine = new ForecastEngine({ busFatorRiskThreshold: 1 });

      const mod = makeModule('src', {}, { busFactor: 3, aggregateCommits: 10 });
      const ts = makeTemporalScore('src');

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const busRisk = forecast.preAntiPatterns.filter(p => p.type === 'bus-factor-risk');
      expect(busRisk.length).toBe(0);
    });

    it('should NOT flag bus factor risk with too few commits', () => {
      const engine = new ForecastEngine({ busFatorRiskThreshold: 1 });

      const mod = makeModule('src', {}, { busFactor: 1, aggregateCommits: 3 });
      const ts = makeTemporalScore('src');

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const busRisk = forecast.preAntiPatterns.filter(p => p.type === 'bus-factor-risk');
      expect(busRisk.length).toBe(0);
    });
  });

  describe('pre-anti-pattern: complexity-spiral', () => {
    it('should detect complexity spiral with accelerating churn and velocity', () => {
      const engine = new ForecastEngine({ antiPatternThreshold: 40 });

      const mod = makeModule('src', {
        churnTrend: 30,
        commitAcceleration: 25,
        direction: 'accelerating',
      });
      const ts = makeTemporalScore('src', {
        temporalScore: 55,
        projectedScore: 30,
        projectionWeeks: 12,
        velocity: makeVelocity({
          churnTrend: 30,
          commitAcceleration: 25,
          direction: 'accelerating',
        }),
      });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const spiral = forecast.preAntiPatterns.filter(p => p.type === 'complexity-spiral');
      expect(spiral.length).toBe(1);
    });
  });

  describe('pre-anti-pattern: coupling-magnet', () => {
    it('should detect coupling magnet with high inbound couplings and acceleration', () => {
      const engine = new ForecastEngine();

      const mod = makeModule('src', { commitAcceleration: 20, direction: 'accelerating' });
      const ts = makeTemporalScore('src', {
        velocity: makeVelocity({ commitAcceleration: 20, direction: 'accelerating' }),
      });

      const couplings: ChangeCoupling[] = [
        { fileA: 'lib/a.ts', fileB: 'src/core.ts', cochangeCount: 5, confidence: 0.8 },
        { fileA: 'utils/b.ts', fileB: 'src/core.ts', cochangeCount: 4, confidence: 0.7 },
        { fileA: 'api/c.ts', fileB: 'src/core.ts', cochangeCount: 6, confidence: 0.9 },
      ];

      const gitReport = makeGitReport([mod], couplings);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const magnet = forecast.preAntiPatterns.filter(p => p.type === 'coupling-magnet');
      expect(magnet.length).toBe(1);
    });
  });

  describe('module forecast', () => {
    it('should classify critical health for very low temporal score', () => {
      const engine = new ForecastEngine();

      const mod = makeModule('src');
      const ts = makeTemporalScore('src', { temporalScore: 20 });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      expect(forecast.modules[0].currentHealth).toBe('critical');
    });

    it('should classify healthy for high temporal score', () => {
      const engine = new ForecastEngine();

      const mod = makeModule('src');
      const ts = makeTemporalScore('src', { temporalScore: 85, trend: 'stable' });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      expect(forecast.modules[0].currentHealth).toBe('healthy');
    });

    it('should forecast breakdown for modules with alerts', () => {
      const engine = new ForecastEngine({ antiPatternThreshold: 40 });

      const mod = makeModule('src', {
        churnTrend: 30,
        commitAcceleration: 25,
        direction: 'accelerating',
      });
      const ts = makeTemporalScore('src', {
        temporalScore: 55,
        projectedScore: 25, // below 30 → breakdown
        trend: 'degrading',
        projectionWeeks: 12,
        velocity: makeVelocity({
          churnTrend: 30,
          commitAcceleration: 25,
          direction: 'accelerating',
        }),
      });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts], { overallTrend: 'degrading' });

      const forecast = engine.forecast(gitReport, temporalReport);

      // Either breakdown or declining due to degrading trend
      expect(['breakdown', 'declining']).toContain(forecast.modules[0].forecast6Months);
    });
  });

  describe('overall outlook', () => {
    it('should be sunny for healthy projects', () => {
      const engine = new ForecastEngine();

      const mod = makeModule('src', {}, { busFactor: 5 });
      const ts = makeTemporalScore('src', { temporalScore: 85, trend: 'stable' });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      expect(forecast.overallOutlook).toBe('sunny');
    });

    it('should be stormy when overall trend is degrading', () => {
      const engine = new ForecastEngine();

      const mod = makeModule('src', { churnTrend: 50, direction: 'accelerating' });
      const ts = makeTemporalScore('src', {
        temporalScore: 40,
        trend: 'degrading',
        velocity: makeVelocity({ churnTrend: 50 }),
      });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts], { overallTrend: 'degrading' });

      const forecast = engine.forecast(gitReport, temporalReport);

      expect(forecast.overallOutlook).toBe('stormy');
    });
  });

  describe('recommendations', () => {
    it('should generate recommendations for critical modules', () => {
      const engine = new ForecastEngine();

      const mod = makeModule('src');
      const ts = makeTemporalScore('src', { temporalScore: 20 });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      expect(forecast.recommendations.length).toBeGreaterThan(0);
      expect(forecast.recommendations[0]).toContain('src');
    });

    it('should return healthy message when no issues', () => {
      const engine = new ForecastEngine();

      const mod = makeModule('src', {}, { busFactor: 5 });
      const ts = makeTemporalScore('src', {
        temporalScore: 90,
        trend: 'stable',
        projectedScore: 88,
      });

      const gitReport = makeGitReport([mod]);
      const temporalReport = makeTemporalReport([ts]);

      const forecast = engine.forecast(gitReport, temporalReport);

      expect(forecast.recommendations.length).toBeGreaterThan(0);
      expect(forecast.recommendations[0].toLowerCase()).toContain('healthy');
    });
  });

  describe('bottleneck probability', () => {
    it('should be higher for degrading low-score modules', () => {
      const engine = new ForecastEngine();

      const goodMod = makeModule('good', {}, { busFactor: 5 });
      const badMod = makeModule('bad', {
        churnTrend: 50, direction: 'accelerating',
      }, { busFactor: 1 });

      const goodTs = makeTemporalScore('good', { temporalScore: 90, trend: 'stable' });
      const badTs = makeTemporalScore('bad', {
        temporalScore: 35,
        trend: 'degrading',
        velocity: makeVelocity({ churnTrend: 50 }),
      });

      const gitReport = makeGitReport([goodMod, badMod]);
      const temporalReport = makeTemporalReport([goodTs, badTs]);

      const forecast = engine.forecast(gitReport, temporalReport);

      const good = forecast.modules.find(m => m.module === 'good')!;
      const bad = forecast.modules.find(m => m.module === 'bad')!;

      expect(bad.bottleneckProbability).toBeGreaterThan(good.bottleneckProbability);
    });
  });
});
