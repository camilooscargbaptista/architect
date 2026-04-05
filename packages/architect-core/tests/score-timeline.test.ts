/**
 * Tests for ScoreTimelineBuilder — Fase 3.2
 *
 * Verifies feature extraction, score reconstruction, and timeline building.
 */

import { ScoreTimelineBuilder, WeeklyFeatures } from '../src/core/analyzers/score-timeline.js';
import type { WeeklySnapshot, GitHistoryReport, ModuleHistory, VelocityVector } from '../src/infrastructure/git-history.js';
import type { ArchitectureScore } from '../src/core/types/core.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeScore(overall: number): ArchitectureScore {
  return {
    overall,
    components: [],
    breakdown: { modularity: overall, coupling: overall, cohesion: overall, layering: overall },
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
  timeline: WeeklySnapshot[],
  modules: ModuleHistory[] = [],
): GitHistoryReport {
  return {
    projectPath: '/project',
    analyzedAt: new Date().toISOString(),
    periodWeeks: timeline.length,
    totalCommits: timeline.reduce((s, w) => s + w.commits, 0),
    totalAuthors: 3,
    modules,
    hotspots: [],
    changeCouplings: [],
    commitTimeline: timeline,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('ScoreTimelineBuilder', () => {
  let builder: ScoreTimelineBuilder;

  beforeEach(() => {
    builder = new ScoreTimelineBuilder();
  });

  describe('extractFeatures', () => {
    it('should extract normalized features from weekly snapshots', () => {
      const timeline = [
        makeSnapshot('2026-01-05', 10, 100, 5),
        makeSnapshot('2026-01-12', 20, 200, 10),
        makeSnapshot('2026-01-19', 5, 50, 3),
      ];

      const features = builder.extractFeatures(timeline, 20);

      expect(features).toHaveLength(3);
      // Peak week (index 1) should have intensity 1.0
      expect(features[1]!.commitIntensity).toBe(1);
      expect(features[1]!.churnIntensity).toBe(1);
      // Low week should have lower intensity
      expect(features[2]!.commitIntensity).toBe(0.25);
      expect(features[2]!.churnIntensity).toBe(0.25);
    });

    it('should calculate complexitySignal as weighted average', () => {
      const timeline = [makeSnapshot('2026-01-05', 10, 100, 5)];
      const features = builder.extractFeatures(timeline, 10);

      // commitIntensity = 10/10 = 1, churnIntensity = 100/100 = 1, activeFileRatio = 5/10 = 0.5
      // complexitySignal = 0.5*1 + 0.3*1 + 0.2*0.5 = 0.9
      expect(features[0]!.complexitySignal).toBeCloseTo(0.9, 1);
    });

    it('should handle empty timeline', () => {
      expect(builder.extractFeatures([], 10)).toEqual([]);
    });

    it('should normalize against zero-file project', () => {
      const timeline = [makeSnapshot('2026-01-05', 5, 50, 0)];
      const features = builder.extractFeatures(timeline, 0);
      expect(features[0]!.activeFileRatio).toBe(0);
    });
  });

  describe('reconstructScoreTimeline', () => {
    it('should produce timeline with correct length', () => {
      const features: WeeklyFeatures[] = [
        { weekOffset: 0, weekStart: '', commitIntensity: 0.5, churnIntensity: 0.5, activeFileRatio: 0.5, complexitySignal: 0.5 },
        { weekOffset: 1, weekStart: '', commitIntensity: 0.5, churnIntensity: 0.5, activeFileRatio: 0.5, complexitySignal: 0.5 },
        { weekOffset: 2, weekStart: '', commitIntensity: 0.5, churnIntensity: 0.5, activeFileRatio: 0.5, complexitySignal: 0.5 },
      ];

      const timeline = builder.reconstructScoreTimeline(features, 75);
      expect(timeline).toHaveLength(3);
    });

    it('should anchor last point at current score', () => {
      const features: WeeklyFeatures[] = [
        { weekOffset: 0, weekStart: '', commitIntensity: 0.3, churnIntensity: 0.3, activeFileRatio: 0.3, complexitySignal: 0.3 },
        { weekOffset: 1, weekStart: '', commitIntensity: 0.7, churnIntensity: 0.7, activeFileRatio: 0.7, complexitySignal: 0.7 },
      ];

      const timeline = builder.reconstructScoreTimeline(features, 80);
      // Last score should be approximately 80 (current)
      // Due to smoothing it may differ slightly
      expect(timeline[timeline.length - 1]!.score).toBeCloseTo(80, 0);
    });

    it('should show higher past scores for high-complexity recent weeks', () => {
      // Recent week had higher complexity → score was likely higher before
      const features: WeeklyFeatures[] = [
        { weekOffset: 0, weekStart: '', commitIntensity: 0.1, churnIntensity: 0.1, activeFileRatio: 0.1, complexitySignal: 0.1 },
        { weekOffset: 1, weekStart: '', commitIntensity: 0.9, churnIntensity: 0.9, activeFileRatio: 0.9, complexitySignal: 0.9 },
      ];

      const timeline = builder.reconstructScoreTimeline(features, 60);
      // First week should have been higher than current 60
      expect(timeline[0]!.score).toBeGreaterThan(60);
    });

    it('should clamp scores to [0, 100]', () => {
      const features: WeeklyFeatures[] = Array.from({ length: 10 }, (_, i) => ({
        weekOffset: i,
        weekStart: '',
        commitIntensity: 1,
        churnIntensity: 1,
        activeFileRatio: 1,
        complexitySignal: 1,
      }));

      const timeline = builder.reconstructScoreTimeline(features, 5);
      for (const point of timeline) {
        expect(point.score).toBeGreaterThanOrEqual(0);
        expect(point.score).toBeLessThanOrEqual(100);
      }
    });

    it('should return single point for empty features', () => {
      const timeline = builder.reconstructScoreTimeline([], 75);
      expect(timeline).toHaveLength(1);
      expect(timeline[0]!.score).toBe(75);
    });
  });

  describe('buildProjectTimeline', () => {
    it('should build complete project timeline', () => {
      const timeline = [
        makeSnapshot('2026-01-05', 10, 100, 5),
        makeSnapshot('2026-01-12', 15, 150, 8),
        makeSnapshot('2026-01-19', 20, 200, 10),
        makeSnapshot('2026-01-26', 12, 120, 6),
      ];

      const gitReport = makeGitReport(timeline, [
        makeModule('src/core'),
        makeModule('src/api'),
      ]);

      const result = builder.buildProjectTimeline(gitReport, makeScore(70), 20);

      expect(result.projectPath).toBe('/project');
      expect(result.scoreTimeline.length).toBe(4);
      expect(result.weeklyFeatures.length).toBe(4);
      expect(result.moduleTimelines.length).toBe(2);
      expect(result.totalWeeks).toBe(4);
    });

    it('should handle empty timeline', () => {
      const gitReport = makeGitReport([]);
      const result = builder.buildProjectTimeline(gitReport, makeScore(80), 10);

      expect(result.scoreTimeline).toHaveLength(1);
      expect(result.scoreTimeline[0]!.score).toBe(80);
      expect(result.totalWeeks).toBe(0);
    });

    it('should produce module timelines with complexity trends', () => {
      const timeline = Array.from({ length: 12 }, (_, i) =>
        makeSnapshot(`2026-0${Math.floor(i / 4) + 1}-0${(i % 4) * 7 + 1}`, 10 + i, 100 + i * 20, 5 + i)
      );

      const gitReport = makeGitReport(timeline, [
        makeModule('src/growing', {
          velocityVector: makeVelocity({ churnTrend: 40, direction: 'accelerating' }),
          aggregateCommits: 100,
          aggregateChurn: 2000,
        }),
      ]);

      const result = builder.buildProjectTimeline(gitReport, makeScore(65), 30);
      expect(result.moduleTimelines.length).toBe(1);
      expect(['increasing', 'stable', 'decreasing']).toContain(result.moduleTimelines[0]!.complexityTrend);
    });
  });
});
