/**
 * Temporal Score Dimension — Adds time-series awareness to architecture scoring
 *
 * Combines current static score with historical velocity to produce:
 * - Trend per module (improving / stable / degrading)
 * - Temporal risk score (static score penalized by negative velocity)
 * - Projected score in N weeks
 *
 * @author Camilo Girardelli — Girardelli Tecnologia
 * @license MIT
 */

import type {
  ModuleHistory,
  VelocityVector,
  GitHistoryReport,
} from '../../infrastructure/git-history.js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type Trend = 'improving' | 'stable' | 'degrading';

export interface TemporalScore {
  /** Module or file path */
  module: string;
  /** Current static score (from ArchitectureScorer) */
  staticScore: number;
  /** Temporal-adjusted score (penalizes degrading trends) */
  temporalScore: number;
  /** Direction of change */
  trend: Trend;
  /** Projected score in projectionWeeks */
  projectedScore: number;
  /** Confidence in the projection (0-1) */
  projectionConfidence: number;
  /** Weeks used for projection */
  projectionWeeks: number;
  /** Risk level derived from temporal analysis */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Velocity data */
  velocity: VelocityVector;
}

export interface TemporalReport {
  projectPath: string;
  analyzedAt: string;
  overallTrend: Trend;
  overallTemporalScore: number;
  modules: TemporalScore[];
  degradingModules: TemporalScore[];
  improvingModules: TemporalScore[];
}

export interface TemporalScorerConfig {
  /** Weeks ahead to project (default: 12) */
  projectionWeeks?: number;
  /** Weight of churn trend in temporal penalty (0-1, default: 0.6) */
  churnWeight?: number;
  /** Weight of commit acceleration in temporal penalty (0-1, default: 0.4) */
  commitWeight?: number;
  /** Threshold for trend classification: accelerating if > threshold % */
  acceleratingThreshold?: number;
  /** Threshold for trend classification: decelerating if < -threshold % */
  deceleratingThreshold?: number;
}

const DEFAULT_CONFIG: Required<TemporalScorerConfig> = {
  projectionWeeks: 12,
  churnWeight: 0.6,
  commitWeight: 0.4,
  acceleratingThreshold: 15,
  deceleratingThreshold: -15,
};

// ═══════════════════════════════════════════════════════════════
// TEMPORAL SCORER
// ═══════════════════════════════════════════════════════════════

export class TemporalScorer {
  private config: Required<TemporalScorerConfig>;

  constructor(config?: TemporalScorerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Score modules temporally using git history + static scores.
   *
   * @param gitReport - Output from GitHistoryAnalyzer
   * @param staticScores - Map of modulePath → static score (0-100)
   */
  score(
    gitReport: GitHistoryReport,
    staticScores: Map<string, number>,
  ): TemporalReport {
    const modules: TemporalScore[] = [];

    for (const moduleHistory of gitReport.modules) {
      const staticScore = staticScores.get(moduleHistory.modulePath)
        ?? this.inferStaticScore(moduleHistory);

      const ts = this.scoreModule(moduleHistory, staticScore);
      modules.push(ts);
    }

    // Sort by risk (worst first)
    modules.sort((a, b) => a.temporalScore - b.temporalScore);

    const degrading = modules.filter(m => m.trend === 'degrading');
    const improving = modules.filter(m => m.trend === 'improving');

    const overallTrend = this.classifyOverallTrend(modules);
    const overallScore = modules.length > 0
      ? Math.round(modules.reduce((s, m) => s + m.temporalScore, 0) / modules.length)
      : 0;

    return {
      projectPath: gitReport.projectPath,
      analyzedAt: new Date().toISOString(),
      overallTrend: overallTrend,
      overallTemporalScore: overallScore,
      modules,
      degradingModules: degrading,
      improvingModules: improving,
    };
  }

  private scoreModule(module: ModuleHistory, staticScore: number): TemporalScore {
    const velocity = module.velocityVector;

    // Calculate temporal penalty based on velocity
    const churnPenalty = velocity.churnTrend > 0
      ? velocity.churnTrend * this.config.churnWeight * 0.3  // 30% impact per 100% churn increase
      : velocity.churnTrend * this.config.churnWeight * 0.1; // 10% bonus per 100% churn decrease

    const commitPenalty = velocity.commitAcceleration > 20
      ? (velocity.commitAcceleration - 20) * this.config.commitWeight * 0.2  // penalty for excessive churn
      : 0;

    const totalPenalty = Math.max(-20, Math.min(30, churnPenalty + commitPenalty));
    const temporalScore = Math.max(0, Math.min(100, Math.round(staticScore - totalPenalty)));

    // Trend classification
    const trend = this.classifyTrend(velocity);

    // Linear projection
    const weeklyDelta = totalPenalty / Math.max(this.config.projectionWeeks, 1);
    const projectedScore = Math.max(0, Math.min(100,
      Math.round(temporalScore - (weeklyDelta * this.config.projectionWeeks))
    ));

    // Confidence decreases with projection distance and instability
    const instability = Math.abs(velocity.churnTrend) + Math.abs(velocity.commitAcceleration);
    const projectionConfidence = Math.max(0.1, Math.min(1,
      1 - (instability / 200) - (this.config.projectionWeeks / 52)
    ));

    const riskLevel = this.classifyRisk(temporalScore, trend, module.busFactor);

    return {
      module: module.modulePath,
      staticScore,
      temporalScore,
      trend,
      projectedScore,
      projectionConfidence: Math.round(projectionConfidence * 100) / 100,
      projectionWeeks: this.config.projectionWeeks,
      riskLevel,
      velocity,
    };
  }

  private classifyTrend(velocity: VelocityVector): Trend {
    // Degrading: churn increasing significantly or commit acceleration very high
    if (velocity.churnTrend > 30 || velocity.commitAcceleration > 50) {
      return 'degrading';
    }
    // Improving: churn decreasing and stable or decelerating
    if (velocity.churnTrend < -10 && velocity.direction !== 'accelerating') {
      return 'improving';
    }
    return 'stable';
  }

  private classifyRisk(
    temporalScore: number,
    trend: Trend,
    busFactor: number,
  ): TemporalScore['riskLevel'] {
    if (temporalScore < 30 || (temporalScore < 50 && trend === 'degrading')) {
      return 'critical';
    }
    if (temporalScore < 50 || (trend === 'degrading' && busFactor <= 1)) {
      return 'high';
    }
    if (temporalScore < 70 || trend === 'degrading') {
      return 'medium';
    }
    return 'low';
  }

  private classifyOverallTrend(modules: TemporalScore[]): Trend {
    if (modules.length === 0) return 'stable';

    const degrading = modules.filter(m => m.trend === 'degrading').length;
    const improving = modules.filter(m => m.trend === 'improving').length;

    const degradingRatio = degrading / modules.length;
    const improvingRatio = improving / modules.length;

    if (degradingRatio > 0.3) return 'degrading';
    if (improvingRatio > 0.3) return 'improving';
    return 'stable';
  }

  /** Infer a static score when none is provided (based on churn metrics) */
  private inferStaticScore(module: ModuleHistory): number {
    const avgChurn = module.aggregateChurn / Math.max(module.aggregateCommits, 1);
    if (avgChurn < 20) return 85;
    if (avgChurn < 50) return 75;
    if (avgChurn < 100) return 65;
    if (avgChurn < 200) return 50;
    return 35;
  }
}
