/**
 * Forecast V2 — ML-Based Architecture Score Prediction
 *
 * Combines git history, dependency graph, and temporal analysis
 * to predict architecture score decay using weighted regression.
 *
 * Pipeline:
 * 1. ScoreTimelineBuilder reconstructs historical score snapshots
 * 2. DecayRegressor fits weighted linear regression on the timeline
 * 3. ForecastV2 enriches with module-level insights and risk factors
 *
 * Output: "If nothing changes, your score will go from 75 to 62 in 8 weeks"
 *
 * @since v9.0 — Fase 3.2
 */

import type { GitHistoryReport } from '../../infrastructure/git-history.js';
import type { AnalysisReport, ArchitectureScore } from '../types/core.js';
import { ScoreTimelineBuilder, type ProjectTimeline, type TimelineBuilderConfig } from './score-timeline.js';
import { DecayRegressor, type DecayForecast, type DecayRegressorConfig, type ScoreDataPoint } from './decay-regressor.js';
import type { TemporalReport } from './temporal-scorer.js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/** Module-level decay prediction */
export interface ModuleDecayPrediction {
  modulePath: string;
  currentScore: number;
  predictedScore: number;
  weeklyDelta: number;
  weeksToThreshold: number;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  complexityTrend: 'increasing' | 'stable' | 'decreasing';
  /** What's driving the decay */
  drivers: string[];
}

/** Full V2 forecast report */
export interface ForecastV2Report {
  projectPath: string;
  generatedAt: string;

  // ── Project-level ──
  /** Overall decay forecast */
  projectForecast: DecayForecast;
  /** Score timeline used for regression */
  timeline: ProjectTimeline;

  // ── Module-level ──
  /** Per-module predictions, sorted by risk */
  modulePredictions: ModuleDecayPrediction[];
  /** Modules projected to cross critical threshold */
  atRiskModules: ModuleDecayPrediction[];

  // ── Summary ──
  /** Human-readable headline */
  headline: string;
  /** Risk assessment */
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  /** Actionable recommendations */
  recommendations: string[];
}

export interface ForecastV2Config {
  timeline?: TimelineBuilderConfig;
  regression?: DecayRegressorConfig;
  /** Critical score threshold (default: 40) */
  criticalThreshold?: number;
  /** Warning score threshold (default: 60) */
  warningThreshold?: number;
}

const DEFAULT_CONFIG: Required<ForecastV2Config> = {
  timeline: {},
  regression: {},
  criticalThreshold: 40,
  warningThreshold: 60,
};

// ═══════════════════════════════════════════════════════════════
// FORECAST V2 ENGINE
// ═══════════════════════════════════════════════════════════════

export class ForecastV2Engine {
  private timelineBuilder: ScoreTimelineBuilder;
  private regressor: DecayRegressor;
  private config: Required<ForecastV2Config>;

  constructor(config?: ForecastV2Config) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.timelineBuilder = new ScoreTimelineBuilder(this.config.timeline);
    this.regressor = new DecayRegressor({
      ...this.config.regression,
      criticalThreshold: this.config.criticalThreshold,
    });
  }

  /**
   * Generate a full V2 forecast from analysis data.
   *
   * @param analysisReport - Current architecture analysis
   * @param gitReport - Git history data
   * @param temporalReport - Optional temporal scoring data (for enrichment)
   */
  predict(
    analysisReport: AnalysisReport,
    gitReport: GitHistoryReport,
    temporalReport?: TemporalReport,
  ): ForecastV2Report {
    // 1. Build score timeline from git history
    const timeline = this.timelineBuilder.buildProjectTimeline(
      gitReport,
      analysisReport.score,
      analysisReport.projectInfo.totalFiles,
    );

    // 2. Run regression on project-level timeline
    const projectForecast = this.regressor.forecast(timeline.scoreTimeline);

    // Fallback if insufficient data
    const forecast = projectForecast ?? this.createFallbackForecast(analysisReport.score);

    // 3. Generate module-level predictions
    const modulePredictions = this.predictModules(
      timeline,
      analysisReport.score,
      temporalReport,
    );

    // 4. Identify at-risk modules
    const atRiskModules = modulePredictions.filter(
      m => m.weeksToThreshold !== Infinity && m.weeksToThreshold <= (this.config.regression?.horizonWeeks ?? 12) * 2
    );

    // 5. Generate report
    const overallRisk = this.classifyOverallRisk(forecast, atRiskModules);
    const headline = this.generateHeadline(forecast, atRiskModules, overallRisk);
    const recommendations = this.generateRecommendations(forecast, modulePredictions, atRiskModules);

    return {
      projectPath: gitReport.projectPath,
      generatedAt: new Date().toISOString(),
      projectForecast: forecast,
      timeline,
      modulePredictions,
      atRiskModules,
      headline,
      overallRisk,
      recommendations,
    };
  }

  // ── Module-Level Prediction ─────────────────────────────────

  private predictModules(
    timeline: ProjectTimeline,
    _currentScore: ArchitectureScore,
    temporalReport?: TemporalReport,
  ): ModuleDecayPrediction[] {
    const predictions: ModuleDecayPrediction[] = [];

    for (const moduleTimeline of timeline.moduleTimelines) {
      const forecast = this.regressor.forecast(moduleTimeline.scoreTimeline);

      if (!forecast) continue;

      // Enrich with temporal data if available
      const temporal = temporalReport?.modules.find(
        m => m.module === moduleTimeline.modulePath
      );

      const drivers = this.identifyDrivers(moduleTimeline, temporal);
      const riskLevel = this.classifyModuleRisk(forecast, moduleTimeline);

      predictions.push({
        modulePath: moduleTimeline.modulePath,
        currentScore: forecast.currentScore,
        predictedScore: forecast.predictedScore,
        weeklyDelta: forecast.weeklyDelta,
        weeksToThreshold: forecast.weeksToThreshold,
        confidence: forecast.confidence,
        riskLevel,
        complexityTrend: moduleTimeline.complexityTrend,
        drivers,
      });
    }

    // Sort by risk (worst first)
    return predictions.sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (riskOrder[a.riskLevel] ?? 4) - (riskOrder[b.riskLevel] ?? 4);
    });
  }

  private identifyDrivers(
    moduleTimeline: {
      complexityTrend: string;
      avgComplexity: number;
      scoreTimeline: ScoreDataPoint[];
    },
    temporal?: { trend: string; velocity: { churnTrend: number; commitAcceleration: number } },
  ): string[] {
    const drivers: string[] = [];

    if (moduleTimeline.complexityTrend === 'increasing') {
      drivers.push('Complexity increasing over time');
    }
    if (moduleTimeline.avgComplexity > 0.7) {
      drivers.push('Consistently high complexity');
    }

    if (temporal) {
      if (temporal.velocity.churnTrend > 30) {
        drivers.push(`High churn trend (+${Math.round(temporal.velocity.churnTrend)}%)`);
      }
      if (temporal.velocity.commitAcceleration > 20) {
        drivers.push(`Accelerating commit rate (+${Math.round(temporal.velocity.commitAcceleration)}%)`);
      }
      if (temporal.trend === 'degrading') {
        drivers.push('Temporal trend: degrading');
      }
    }

    if (drivers.length === 0) {
      drivers.push('No significant risk drivers detected');
    }

    return drivers;
  }

  private classifyModuleRisk(
    forecast: DecayForecast,
    moduleTimeline: { complexityTrend: string },
  ): ModuleDecayPrediction['riskLevel'] {
    if (forecast.predictedScore < this.config.criticalThreshold) return 'critical';
    if (forecast.predictedScore < this.config.warningThreshold && moduleTimeline.complexityTrend === 'increasing') return 'high';
    if (forecast.scoreDelta < -5) return 'medium';
    return 'low';
  }

  // ── Overall Assessment ──────────────────────────────────────

  private classifyOverallRisk(
    forecast: DecayForecast,
    atRiskModules: ModuleDecayPrediction[],
  ): ForecastV2Report['overallRisk'] {
    const criticalCount = atRiskModules.filter(m => m.riskLevel === 'critical').length;

    if (forecast.predictedScore < this.config.criticalThreshold || criticalCount >= 2) return 'critical';
    if (forecast.scoreDelta < -10 || criticalCount >= 1) return 'high';
    if (forecast.scoreDelta < -5 || atRiskModules.length > 0) return 'medium';
    return 'low';
  }

  private generateHeadline(
    forecast: DecayForecast,
    atRiskModules: ModuleDecayPrediction[],
    overallRisk: ForecastV2Report['overallRisk'],
  ): string {
    const current = Math.round(forecast.currentScore);
    const predicted = Math.round(forecast.predictedScore);
    const horizon = forecast.regression.dataPoints > 0 ? (this.config.regression?.horizonWeeks ?? 12) : 12;

    switch (overallRisk) {
      case 'critical':
        return `Architecture score projected to drop from ${current} to ${predicted} in ${horizon} weeks. ${atRiskModules.length} module(s) at critical risk. Immediate action required.`;
      case 'high':
        return `Architecture score trending down: ${current} → ${predicted} in ${horizon} weeks. ${atRiskModules.length} module(s) approaching critical threshold.`;
      case 'medium':
        return `Architecture showing moderate decay: ${current} → ${predicted} in ${horizon} weeks. Proactive refactoring recommended.`;
      case 'low':
        return `Architecture stable at ${current}/100. No significant decay projected over the next ${horizon} weeks.`;
    }
  }

  private generateRecommendations(
    forecast: DecayForecast,
    allModules: ModuleDecayPrediction[],
    atRiskModules: ModuleDecayPrediction[],
  ): string[] {
    const recs: string[] = [];

    // Critical modules
    const critical = atRiskModules.filter(m => m.riskLevel === 'critical');
    if (critical.length > 0) {
      recs.push(`Immediate: stabilize ${critical.map(m => m.modulePath).join(', ')} — freeze features and invest in refactoring.`);
    }

    // High-complexity modules
    const increasing = allModules.filter(m => m.complexityTrend === 'increasing');
    if (increasing.length > 0) {
      recs.push(`Reduce complexity in: ${increasing.slice(0, 3).map(m => m.modulePath).join(', ')}. These modules show increasing complexity over time.`);
    }

    // Overall decay
    if (forecast.weeklyDelta < -0.5) {
      recs.push(`Overall score declining at ${Math.abs(forecast.weeklyDelta).toFixed(1)} points/week. Review recent architectural decisions.`);
    }

    // Threshold warning
    if (forecast.weeksToThreshold !== Infinity && forecast.weeksToThreshold <= 26) {
      recs.push(`Critical threshold (${this.config.criticalThreshold}) will be reached in ~${forecast.weeksToThreshold} weeks without intervention.`);
    }

    if (recs.length === 0) {
      recs.push('Architecture is healthy and stable. Continue monitoring temporal trends.');
    }

    return recs.slice(0, 5);
  }

  // ── Fallback ────────────────────────────────────────────────

  private createFallbackForecast(score: ArchitectureScore): DecayForecast {
    return {
      currentScore: score.overall,
      predictedScore: score.overall,
      scoreDelta: 0,
      weeklyDelta: 0,
      weeksToThreshold: Infinity,
      threshold: this.config.criticalThreshold,
      confidence: 0.1,
      regression: {
        slope: 0,
        intercept: score.overall,
        rSquared: 0,
        dataPoints: 0,
        slopeStdError: 0,
        isSignificant: false,
      },
      trajectory: [],
      summary: `Insufficient git history data for regression-based forecast. Current score: ${score.overall}/100.`,
    };
  }
}
