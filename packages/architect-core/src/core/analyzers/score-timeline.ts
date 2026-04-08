/**
 * Score Timeline Builder — Reconstruct Historical Architecture Scores
 *
 * Uses the weekly commit timeline from GitHistoryReport to reconstruct
 * how the architecture score evolved over time. Combines:
 * - Weekly churn/commit snapshots (proxy for code health changes)
 * - Current static score (ground truth anchor)
 * - Dependency graph density evolution (structural complexity)
 *
 * The key insight: we can't run the full analyzer at past commits,
 * but we CAN infer relative score changes from churn patterns.
 * High churn weeks = likely score degradation. Stable weeks = likely stable score.
 *
 * @since v9.0 — Fase 3.2
 */

import type { WeeklySnapshot, GitHistoryReport, ModuleHistory } from '../../infrastructure/git-history.js';
import type { ArchitectureScore } from '../types/core.js';
import type { ScoreDataPoint } from './decay-regressor.js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/** Feature vector extracted from a weekly snapshot */
export interface WeeklyFeatures {
  weekOffset: number;
  weekStart: string;
  /** Normalized commit count (0-1 relative to max week) */
  commitIntensity: number;
  /** Normalized churn (0-1 relative to max week) */
  churnIntensity: number;
  /** Active files ratio (0-1 relative to total project files) */
  activeFileRatio: number;
  /** Combined complexity signal */
  complexitySignal: number;
}

/** Per-module timeline with feature vectors */
export interface ModuleTimeline {
  modulePath: string;
  features: WeeklyFeatures[];
  scoreTimeline: ScoreDataPoint[];
  /** Average weekly complexity signal */
  avgComplexity: number;
  /** Trend direction of complexity */
  complexityTrend: 'increasing' | 'stable' | 'decreasing';
}

/** Project-level score timeline */
export interface ProjectTimeline {
  projectPath: string;
  /** Overall score evolution over time */
  scoreTimeline: ScoreDataPoint[];
  /** Per-module timelines */
  moduleTimelines: ModuleTimeline[];
  /** Features per week (for debugging/inspection) */
  weeklyFeatures: WeeklyFeatures[];
  /** Total weeks of data */
  totalWeeks: number;
}

export interface TimelineBuilderConfig {
  /** Weight of churn in the complexity signal (default: 0.5) */
  churnWeight?: number;
  /** Weight of commit frequency in the complexity signal (default: 0.3) */
  commitWeight?: number;
  /** Weight of file spread in the complexity signal (default: 0.2) */
  fileSpreadWeight?: number;
  /** Max score penalty per high-complexity week (default: 3) */
  maxWeeklyPenalty?: number;
  /** Smoothing factor for score reconstruction (default: 0.3) */
  smoothingAlpha?: number;
}

const DEFAULT_CONFIG: Required<TimelineBuilderConfig> = {
  churnWeight: 0.5,
  commitWeight: 0.3,
  fileSpreadWeight: 0.2,
  maxWeeklyPenalty: 3,
  smoothingAlpha: 0.3,
};

// ═══════════════════════════════════════════════════════════════
// SCORE TIMELINE BUILDER
// ═══════════════════════════════════════════════════════════════

export class ScoreTimelineBuilder {
  private config: Required<TimelineBuilderConfig>;

  constructor(config?: TimelineBuilderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build a score timeline from git history and current score.
   *
   * Strategy: work backwards from the current score. Each week's
   * complexity signal tells us how much the score likely changed
   * that week. High complexity = score degradation.
   *
   * @param gitReport - Git history with weekly snapshots
   * @param currentScore - Current architecture score (ground truth)
   * @param totalFiles - Total files in the project (for normalization)
   */
  buildProjectTimeline(
    gitReport: GitHistoryReport,
    currentScore: ArchitectureScore,
    totalFiles: number,
  ): ProjectTimeline {
    const timeline = gitReport.commitTimeline;
    if (timeline.length === 0) {
      return {
        projectPath: gitReport.projectPath,
        scoreTimeline: [{ weekOffset: 0, score: currentScore.overall }],
        moduleTimelines: [],
        weeklyFeatures: [],
        totalWeeks: 0,
      };
    }

    // 1. Extract features from weekly snapshots
    const features = this.extractFeatures(timeline, totalFiles);

    // 2. Reconstruct score timeline from features + current score
    const scoreTimeline = this.reconstructScoreTimeline(
      features,
      currentScore.overall,
    );

    // 3. Build per-module timelines
    const moduleTimelines = this.buildModuleTimelines(
      gitReport.modules,
      currentScore,
    );

    return {
      projectPath: gitReport.projectPath,
      scoreTimeline,
      moduleTimelines,
      weeklyFeatures: features,
      totalWeeks: timeline.length,
    };
  }

  /**
   * Extract normalized feature vectors from weekly snapshots.
   */
  extractFeatures(
    timeline: WeeklySnapshot[],
    totalFiles: number,
  ): WeeklyFeatures[] {
    if (timeline.length === 0) return [];

    // Find max values for normalization
    const maxCommits = Math.max(1, ...timeline.map(w => w.commits));
    const maxChurn = Math.max(1, ...timeline.map(w => w.churn));
    const effectiveFiles = Math.max(1, totalFiles);

    return timeline.map((week, index) => {
      const commitIntensity = week.commits / maxCommits;
      const churnIntensity = week.churn / maxChurn;
      const activeFileRatio = Math.min(1, week.activeFiles / effectiveFiles);

      // Combined complexity signal: weighted average of normalized metrics
      const complexitySignal =
        this.config.churnWeight * churnIntensity +
        this.config.commitWeight * commitIntensity +
        this.config.fileSpreadWeight * activeFileRatio;

      return {
        weekOffset: index,
        weekStart: week.weekStart,
        commitIntensity: Math.round(commitIntensity * 1000) / 1000,
        churnIntensity: Math.round(churnIntensity * 1000) / 1000,
        activeFileRatio: Math.round(activeFileRatio * 1000) / 1000,
        complexitySignal: Math.round(complexitySignal * 1000) / 1000,
      };
    });
  }

  /**
   * Reconstruct historical scores by walking backwards from current score.
   *
   * For each week, the complexity signal determines how much the score
   * changed. High-complexity weeks = score degradation. Low-complexity
   * weeks = score recovery or stability.
   *
   * Uses exponential smoothing to avoid noise artifacts.
   */
  reconstructScoreTimeline(
    features: WeeklyFeatures[],
    currentScore: number,
  ): ScoreDataPoint[] {
    if (features.length === 0) {
      return [{ weekOffset: 0, score: currentScore }];
    }

    // Average complexity = the "normal" level for this project
    const avgComplexity = features.reduce((s, f) => s + f.complexitySignal, 0) / features.length;

    // Work backwards: each week, reverse the estimated impact
    const scores: number[] = new Array(features.length);
    scores[features.length - 1] = currentScore;

    for (let i = features.length - 2; i >= 0; i--) {
      const feature = features[i + 1]!;
      // Delta above/below average = estimated weekly score change
      const deviation = feature.complexitySignal - avgComplexity;
      const penalty = deviation * this.config.maxWeeklyPenalty;
      // Clamp to prevent wild swings
      const clampedPenalty = Math.max(-this.config.maxWeeklyPenalty, Math.min(this.config.maxWeeklyPenalty, penalty));
      // Reverse the penalty to get the previous week's score
      const rawScore = scores[i + 1]! + clampedPenalty;
      scores[i] = Math.max(0, Math.min(100, rawScore));
    }

    // Apply exponential smoothing to reduce noise
    const smoothed = this.exponentialSmooth(scores);

    return smoothed.map((score, index) => ({
      weekOffset: index,
      score: Math.round(score * 10) / 10,
    }));
  }

  /**
   * Build per-module score timelines using module-specific velocity data.
   */
  private buildModuleTimelines(
    modules: ModuleHistory[],
    currentScore: ArchitectureScore,
  ): ModuleTimeline[] {
    const timelines: ModuleTimeline[] = [];

    for (const mod of modules) {
      const velocity = mod.velocityVector;

      // Estimate module-level features from aggregated metrics
      const totalWeeks = Math.max(1, Math.ceil(mod.aggregateCommits / Math.max(mod.avgWeeklyRate, 0.1)));
      const weeklyChurn = mod.aggregateChurn / totalWeeks;

      // Create simplified per-module features
      const features: WeeklyFeatures[] = [];
      for (let w = 0; w < totalWeeks && w < 24; w++) {
        // Apply velocity trend to estimate weekly progression
        const trendFactor = 1 + (velocity.churnTrend / 100) * (w / totalWeeks);
        const complexitySignal = Math.min(1, (weeklyChurn * trendFactor) / Math.max(mod.aggregateChurn, 1));

        features.push({
          weekOffset: w,
          weekStart: '',
          commitIntensity: Math.min(1, mod.avgWeeklyRate / Math.max(mod.aggregateCommits / totalWeeks, 1)),
          churnIntensity: Math.min(1, complexitySignal),
          activeFileRatio: mod.files.length / Math.max(mod.files.length, 1),
          complexitySignal: Math.round(complexitySignal * 1000) / 1000,
        });
      }

      // Use current score as anchor
      const moduleScore = currentScore.overall;
      const scoreTimeline = this.reconstructScoreTimeline(features, moduleScore);

      // Classify complexity trend
      const firstHalf = features.slice(0, Math.floor(features.length / 2));
      const secondHalf = features.slice(Math.floor(features.length / 2));
      const avgFirst = firstHalf.length > 0 ? firstHalf.reduce((s, f) => s + f.complexitySignal, 0) / firstHalf.length : 0;
      const avgSecond = secondHalf.length > 0 ? secondHalf.reduce((s, f) => s + f.complexitySignal, 0) / secondHalf.length : 0;

      let complexityTrend: ModuleTimeline['complexityTrend'] = 'stable';
      if (avgSecond > avgFirst * 1.15) complexityTrend = 'increasing';
      else if (avgSecond < avgFirst * 0.85) complexityTrend = 'decreasing';

      timelines.push({
        modulePath: mod.modulePath,
        features,
        scoreTimeline,
        avgComplexity: Math.round((features.reduce((s, f) => s + f.complexitySignal, 0) / Math.max(features.length, 1)) * 1000) / 1000,
        complexityTrend,
      });
    }

    return timelines;
  }

  /**
   * Simple exponential smoothing (EMA).
   */
  private exponentialSmooth(values: number[]): number[] {
    if (values.length === 0) return [];

    const alpha = this.config.smoothingAlpha;
    const smoothed = [values[0]!];

    for (let i = 1; i < values.length; i++) {
      smoothed.push(alpha * values[i]! + (1 - alpha) * smoothed[i - 1]!);
    }

    return smoothed;
  }
}
