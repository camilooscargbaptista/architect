/**
 * Architecture Weather Forecast — Predictive analysis
 *
 * Combines temporal scores + velocity vectors + change coupling
 * to predict which modules will become anti-patterns.
 *
 * Key concept: Pre-Anti-Pattern
 * A module isn't an anti-pattern yet, but its trajectory says it will be.
 * "Your code doesn't have a problem — it WILL have one in 3 months."
 *
 * @author Camilo Girardelli — Girardelli Tecnologia
 * @license MIT
 */

import type {
  GitHistoryReport,
  ModuleHistory,
  ChangeCoupling,
    // @ts-ignore - Audit cleanup unused variable
  FileHistory,
} from '../../infrastructure/git-history.js';
import type { TemporalReport, TemporalScore } from './temporal-scorer.js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type PreAntiPatternType =
  | 'emerging-god-class'
  | 'emerging-shotgun-surgery'
  | 'emerging-feature-envy'
  | 'bus-factor-risk'
  | 'complexity-spiral'
  | 'coupling-magnet';

export interface PreAntiPattern {
  type: PreAntiPatternType;
  module: string;
  severity: 'warning' | 'watch' | 'alert';
  currentScore: number;
  projectedScore: number;
  /** Estimated weeks until threshold breach */
  weeksToThreshold: number;
  /** What threshold will be crossed */
  threshold: number;
  description: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
}

export interface ModuleForecast {
  module: string;
  currentHealth: 'healthy' | 'at-risk' | 'degrading' | 'critical';
  forecast6Months: 'stable' | 'declining' | 'breakdown';
  preAntiPatterns: PreAntiPattern[];
  bottleneckProbability: number;  // 0-1
  riskFactors: string[];
  topAction: string;
}

export interface WeatherForecast {
  projectPath: string;
  generatedAt: string;
  overallOutlook: 'sunny' | 'cloudy' | 'stormy';
  headline: string;
  modules: ModuleForecast[];
  preAntiPatterns: PreAntiPattern[];
  topRisks: string[];
  recommendations: string[];
}

export interface ForecastConfig {
  /** Score threshold for anti-pattern (default: 40) */
  antiPatternThreshold?: number;
  /** Churn rate threshold for god class emergence (default: 150 lines/commit) */
  godClassChurnThreshold?: number;
  /** Co-change count for shotgun surgery (default: 5) */
  shotgunCouplingThreshold?: number;
  /** Max bus factor for risk (default: 1) */
  busFatorRiskThreshold?: number;
  /** Weeks for projection (default: 26 — 6 months) */
  forecastWeeks?: number;
}

const DEFAULT_CONFIG: Required<ForecastConfig> = {
  antiPatternThreshold: 40,
  godClassChurnThreshold: 150,
  shotgunCouplingThreshold: 5,
  busFatorRiskThreshold: 1,
  forecastWeeks: 26,
};

// ═══════════════════════════════════════════════════════════════
// FORECAST ENGINE
// ═══════════════════════════════════════════════════════════════

export class ForecastEngine {
  private config: Required<ForecastConfig>;

  constructor(config?: ForecastConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate architecture weather forecast.
   */
  forecast(
    gitReport: GitHistoryReport,
    temporalReport: TemporalReport,
  ): WeatherForecast {
    const preAntiPatterns: PreAntiPattern[] = [];
    const moduleForecastMap = new Map<string, ModuleForecast>();

    // Detect pre-anti-patterns for each module
    for (const module of gitReport.modules) {
      const temporal = temporalReport.modules.find(m => m.module === module.modulePath);
      if (!temporal) continue;

      const patterns = this.detectPreAntiPatterns(module, temporal, gitReport.changeCouplings);
      preAntiPatterns.push(...patterns);

      const forecast = this.forecastModule(module, temporal, patterns);
      moduleForecastMap.set(module.modulePath, forecast);
    }

    // Sort by risk
    const modules = Array.from(moduleForecastMap.values())
      .sort((a, b) => b.bottleneckProbability - a.bottleneckProbability);

    const outlook = this.classifyOutlook(temporalReport, preAntiPatterns);
    const headline = this.generateHeadline(outlook, preAntiPatterns, modules);
    const topRisks = this.identifyTopRisks(modules, preAntiPatterns);
    const recommendations = this.generateRecommendations(modules, preAntiPatterns);

    return {
      projectPath: gitReport.projectPath,
      generatedAt: new Date().toISOString(),
      overallOutlook: outlook,
      headline,
      modules,
      preAntiPatterns: preAntiPatterns.sort((a, b) => a.weeksToThreshold - b.weeksToThreshold),
      topRisks,
      recommendations,
    };
  }

  // ── Pre-Anti-Pattern Detection ──

  private detectPreAntiPatterns(
    module: ModuleHistory,
    temporal: TemporalScore,
    couplings: ChangeCoupling[],
  ): PreAntiPattern[] {
    const patterns: PreAntiPattern[] = [];

    patterns.push(...this.detectEmergingGodClass(module, temporal));
    patterns.push(...this.detectEmergingShotgunSurgery(module, couplings));
    patterns.push(...this.detectBusFactorRisk(module, temporal));
    patterns.push(...this.detectComplexitySpiral(module, temporal));
    patterns.push(...this.detectCouplingMagnet(module, couplings, temporal));

    return patterns;
  }

  private detectEmergingGodClass(
    module: ModuleHistory,
    temporal: TemporalScore,
  ): PreAntiPattern[] {
    const patterns: PreAntiPattern[] = [];

    for (const file of module.files) {
      if (file.churnRate < this.config.godClassChurnThreshold) continue;
      if (temporal.velocity.churnTrend <= 0) continue;

      // Project when churn will exceed critical threshold
      const weeklyGrowth = file.churnRate * (temporal.velocity.churnTrend / 100) / 4;
      const criticalChurn = this.config.godClassChurnThreshold * 2;
      const weeksToThreshold = weeklyGrowth > 0
        ? Math.ceil((criticalChurn - file.churnRate) / weeklyGrowth)
        : Infinity;

      if (weeksToThreshold <= this.config.forecastWeeks) {
        patterns.push({
          type: 'emerging-god-class',
          module: module.modulePath,
          severity: weeksToThreshold <= 8 ? 'alert' : weeksToThreshold <= 16 ? 'warning' : 'watch',
          currentScore: temporal.staticScore,
          projectedScore: temporal.projectedScore,
          weeksToThreshold,
          threshold: criticalChurn,
          description: `File '${file.path}' has churn rate ${Math.round(file.churnRate)} lines/commit and growing ${Math.round(temporal.velocity.churnTrend)}%`,
          evidence: [
            `Current churn: ${Math.round(file.churnRate)} lines/commit`,
            `Growth rate: ${Math.round(temporal.velocity.churnTrend)}%`,
            `${file.commits} commits in analysis period`,
            `${file.authors.size} contributor(s)`,
          ],
          recommendation: 'Split into smaller, focused modules before complexity makes refactoring prohibitively expensive.',
          confidence: Math.min(0.9, 0.5 + (file.commits / 50)),
        });
      }
    }

    return patterns;
  }

  private detectEmergingShotgunSurgery(
    module: ModuleHistory,
    couplings: ChangeCoupling[],
  ): PreAntiPattern[] {
    // Count how many files this module is coupled with
    const moduleCouplings = couplings.filter(
      c => c.fileA.startsWith(module.modulePath) || c.fileB.startsWith(module.modulePath)
    );

    if (moduleCouplings.length < this.config.shotgunCouplingThreshold) return [];

    const avgConfidence = moduleCouplings.reduce((s, c) => s + c.confidence, 0) / moduleCouplings.length;

    return [{
      type: 'emerging-shotgun-surgery',
      module: module.modulePath,
      severity: moduleCouplings.length > 10 ? 'alert' : 'warning',
      currentScore: 0,
      projectedScore: 0,
      weeksToThreshold: 4,
      threshold: this.config.shotgunCouplingThreshold,
      description: `Module '${module.modulePath}' has ${moduleCouplings.length} change-coupled files — changes here ripple across the codebase`,
      evidence: [
        `${moduleCouplings.length} files change together with this module`,
        `Average coupling confidence: ${Math.round(avgConfidence * 100)}%`,
        ...moduleCouplings.slice(0, 3).map(c =>
          `${c.fileA} ↔ ${c.fileB} (${c.cochangeCount} co-changes)`
        ),
      ],
      recommendation: 'Extract shared concerns into a dedicated module. Introduce interfaces to decouple.',
      confidence: avgConfidence,
    }];
  }

  private detectBusFactorRisk(
    module: ModuleHistory,
    temporal: TemporalScore,
  ): PreAntiPattern[] {
    if (module.busFactor > this.config.busFatorRiskThreshold) return [];
    if (module.aggregateCommits < 5) return [];  // too few commits to judge

    return [{
      type: 'bus-factor-risk',
      module: module.modulePath,
      severity: temporal.trend === 'degrading' ? 'alert' : 'warning',
      currentScore: temporal.staticScore,
      projectedScore: temporal.projectedScore,
      weeksToThreshold: this.config.forecastWeeks,
      threshold: 2,
      description: `Module '${module.modulePath}' has bus factor of ${module.busFactor} — all knowledge in one person`,
      evidence: [
        `Only ${module.busFactor} contributor(s)`,
        `${module.aggregateCommits} total commits`,
        `${module.files.length} files in module`,
      ],
      recommendation: 'Pair programming or code review rotation to spread knowledge. Document critical decisions.',
      confidence: 0.8,
    }];
  }

  private detectComplexitySpiral(
    module: ModuleHistory,
    temporal: TemporalScore,
  ): PreAntiPattern[] {
    if (temporal.velocity.churnTrend <= 20) return [];
    if (temporal.velocity.direction !== 'accelerating') return [];

    // Accelerating churn + increasing commit rate = complexity spiral
    const weeklyScoreDecay = (temporal.staticScore - temporal.projectedScore) / temporal.projectionWeeks;
    const weeksToThreshold = weeklyScoreDecay > 0
      ? Math.ceil((temporal.temporalScore - this.config.antiPatternThreshold) / weeklyScoreDecay)
      : Infinity;

    if (weeksToThreshold > this.config.forecastWeeks) return [];

    return [{
      type: 'complexity-spiral',
      module: module.modulePath,
      severity: weeksToThreshold <= 8 ? 'alert' : 'warning',
      currentScore: temporal.temporalScore,
      projectedScore: temporal.projectedScore,
      weeksToThreshold,
      threshold: this.config.antiPatternThreshold,
      description: `Module '${module.modulePath}' is in a complexity spiral — accelerating churn with increasing commit frequency`,
      evidence: [
        `Churn trend: +${Math.round(temporal.velocity.churnTrend)}%`,
        `Commit acceleration: +${Math.round(temporal.velocity.commitAcceleration)}%`,
        `Current temporal score: ${temporal.temporalScore}/100`,
        `Projected score in ${temporal.projectionWeeks} weeks: ${temporal.projectedScore}/100`,
      ],
      recommendation: 'Stop adding features to this module. Invest in refactoring and test coverage first.',
      confidence: temporal.projectionConfidence,
    }];
  }

  private detectCouplingMagnet(
    module: ModuleHistory,
    couplings: ChangeCoupling[],
    temporal: TemporalScore,
  ): PreAntiPattern[] {
    // Files that are increasingly coupled with many others
    const inboundCouplings = couplings.filter(
      c => c.fileB.startsWith(module.modulePath) && c.confidence > 0.5
    );

    if (inboundCouplings.length < 3) return [];
    if (temporal.velocity.commitAcceleration <= 0) return [];

    return [{
      type: 'coupling-magnet',
      module: module.modulePath,
      severity: 'watch',
      currentScore: temporal.staticScore,
      projectedScore: temporal.projectedScore,
      weeksToThreshold: 12,
      threshold: 10,
      description: `Module '${module.modulePath}' is becoming a coupling magnet — ${inboundCouplings.length} high-confidence inbound dependencies`,
      evidence: [
        `${inboundCouplings.length} modules depend on changes here`,
        `Module commit rate accelerating: +${Math.round(temporal.velocity.commitAcceleration)}%`,
      ],
      recommendation: 'Extract stable interfaces. Consider the Dependency Inversion Principle to break inbound coupling.',
      confidence: 0.6,
    }];
  }

  // ── Module Forecast ──

  private forecastModule(
    module: ModuleHistory,
    temporal: TemporalScore,
    patterns: PreAntiPattern[],
  ): ModuleForecast {
    const health = this.classifyHealth(temporal);
    const forecast6m = this.classify6MonthForecast(temporal, patterns);
    const bottleneckProb = this.calculateBottleneckProbability(temporal, patterns, module);

    const riskFactors: string[] = [];
    if (temporal.trend === 'degrading') riskFactors.push('Score degrading');
    if (module.busFactor <= 1) riskFactors.push('Single contributor');
    if (temporal.velocity.churnTrend > 30) riskFactors.push('Churn increasing');
    if (patterns.length > 0) riskFactors.push(`${patterns.length} pre-anti-pattern(s)`);

    const topAction = patterns.length > 0
      ? patterns[0].recommendation
      : temporal.trend === 'degrading'
        ? 'Review recent changes and stabilize'
        : 'No action needed';

    return {
      module: module.modulePath,
      currentHealth: health,
      forecast6Months: forecast6m,
      preAntiPatterns: patterns,
      bottleneckProbability: bottleneckProb,
      riskFactors,
      topAction,
    };
  }

  private classifyHealth(temporal: TemporalScore): ModuleForecast['currentHealth'] {
    if (temporal.temporalScore < 30) return 'critical';
    if (temporal.temporalScore < 50 || temporal.trend === 'degrading') return 'degrading';
    if (temporal.temporalScore < 70) return 'at-risk';
    return 'healthy';
  }

  private classify6MonthForecast(
    temporal: TemporalScore,
    patterns: PreAntiPattern[],
  ): ModuleForecast['forecast6Months'] {
    const alerts = patterns.filter(p => p.severity === 'alert');
    if (alerts.length > 0 || temporal.projectedScore < 30) return 'breakdown';
    if (temporal.trend === 'degrading' || patterns.length > 0) return 'declining';
    return 'stable';
  }

  private calculateBottleneckProbability(
    temporal: TemporalScore,
    patterns: PreAntiPattern[],
    module: ModuleHistory,
  ): number {
    let prob = 0;

    // Low score → higher probability
    if (temporal.temporalScore < 50) prob += 0.3;
    else if (temporal.temporalScore < 70) prob += 0.1;

    // Degrading trend
    if (temporal.trend === 'degrading') prob += 0.2;

    // Pre-anti-patterns
    prob += Math.min(0.3, patterns.length * 0.1);

    // Low bus factor
    if (module.busFactor <= 1) prob += 0.1;

    // High churn
    if (temporal.velocity.churnTrend > 30) prob += 0.1;

    return Math.min(1, Math.round(prob * 100) / 100);
  }

  // ── Overall Analysis ──

  private classifyOutlook(
    temporal: TemporalReport,
    patterns: PreAntiPattern[],
  ): WeatherForecast['overallOutlook'] {
    const alerts = patterns.filter(p => p.severity === 'alert');
    if (alerts.length >= 2 || temporal.overallTrend === 'degrading') return 'stormy';
    if (alerts.length >= 1 || patterns.length >= 3) return 'cloudy';
    return 'sunny';
  }

  private generateHeadline(
    outlook: WeatherForecast['overallOutlook'],
    patterns: PreAntiPattern[],
    modules: ModuleForecast[],
  ): string {
    const critical = modules.filter(m => m.currentHealth === 'critical').length;
    const degrading = modules.filter(m => m.currentHealth === 'degrading').length;

    switch (outlook) {
      case 'stormy':
        return `${critical + degrading} module(s) at risk. ${patterns.length} pre-anti-pattern(s) detected. Immediate action recommended.`;
      case 'cloudy':
        return `Architecture trending stable with ${patterns.length} emerging concern(s). Proactive refactoring recommended.`;
      case 'sunny':
        return 'Architecture is healthy and stable. Continue current practices.';
    }
  }

  private identifyTopRisks(
    modules: ModuleForecast[],
    patterns: PreAntiPattern[],
  ): string[] {
    const risks: string[] = [];

    const breakdowns = modules.filter(m => m.forecast6Months === 'breakdown');
    if (breakdowns.length > 0) {
      risks.push(`${breakdowns.length} module(s) projected to break down within 6 months: ${breakdowns.map(m => m.module).join(', ')}`);
    }

    const busRisks = patterns.filter(p => p.type === 'bus-factor-risk');
    if (busRisks.length > 0) {
      risks.push(`Bus factor risk in ${busRisks.length} module(s) — knowledge concentrated in single contributors`);
    }

    const spirals = patterns.filter(p => p.type === 'complexity-spiral');
    if (spirals.length > 0) {
      risks.push(`Complexity spiral detected in: ${spirals.map(p => p.module).join(', ')}`);
    }

    return risks.slice(0, 5);
  }

  private generateRecommendations(
    modules: ModuleForecast[],
    patterns: PreAntiPattern[],
  ): string[] {
    const recs: string[] = [];

    const critical = modules.filter(m => m.currentHealth === 'critical');
    if (critical.length > 0) {
      recs.push(`Immediate: Stabilize ${critical.map(m => m.module).join(', ')} — freeze features, invest in refactoring`);
    }

    const godClasses = patterns.filter(p => p.type === 'emerging-god-class');
    if (godClasses.length > 0) {
      recs.push(`Split growing files before they become god classes: ${godClasses.map(p => p.module).join(', ')}`);
    }

    const shotgun = patterns.filter(p => p.type === 'emerging-shotgun-surgery');
    if (shotgun.length > 0) {
      recs.push(`Decouple modules with high change coupling to prevent shotgun surgery`);
    }

    const busRisks = patterns.filter(p => p.type === 'bus-factor-risk');
    if (busRisks.length > 0) {
      recs.push(`Spread knowledge: pair programming or rotation for ${busRisks.map(p => p.module).join(', ')}`);
    }

    if (recs.length === 0) {
      recs.push('Architecture is healthy. Continue monitoring temporal trends.');
    }

    return recs.slice(0, 5);
  }
}
