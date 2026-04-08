/**
 * Forecast Agent
 *
 * Analyzes KB score history to predict future architecture trends.
 * Uses linear regression on score history to project where the score
 * is heading and warns about potential degradation.
 *
 * Capabilities: forecast
 *
 * @since v10.0.0 — Phase 2B
 */

import { resolve } from 'path';
import { existsSync } from 'fs';
import { BaseArchitectureAgent } from './base-agent.js';
import type { AgentContext, AgentResult, AgentMetadata } from './types.js';

interface ScorePoint {
  timestamp: string;
  overall: number;
}

interface TrendResult {
  slope: number;
  intercept: number;
  rSquared: number;
  projected30d: number;
  projected90d: number;
  trend: 'improving' | 'stable' | 'degrading';
}

export class ForecastAgent extends BaseArchitectureAgent {
  readonly metadata: AgentMetadata = {
    id: 'forecast-agent',
    name: 'Architecture Forecast Agent',
    description: 'Predicts future architecture score trends using KB history. Warns about potential degradation.',
    capabilities: ['forecast'],
    version: '10.0.0',
  };

  async preflight(context: AgentContext): Promise<string | null> {
    const absPath = resolve(context.projectPath);
    if (!existsSync(absPath)) {
      return `Project path does not exist: ${absPath}`;
    }
    const kbPath = resolve(absPath, '.architect', 'knowledge-base.sqlite');
    if (!existsSync(kbPath)) {
      return 'No Knowledge Base found. Run `architect analyze` at least 3 times first.';
    }
    return null;
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const absPath = resolve(context.projectPath);

    const { KnowledgeBase } = await import(
      '@girardelli/architect-core/src/core/knowledge-base/knowledge-base.js'
    );

    const kb = new KnowledgeBase(absPath);
    try {
      const project = kb.getProjectByPath(absPath);
      if (!project) {
        return this.fail(start, 'Project not found in KB. Run `architect analyze` first.');
      }

      const history = kb.getScoreHistory(project.id) as ScorePoint[];
      if (history.length < 3) {
        return this.fail(start, `Insufficient history (${history.length} analyses). Need at least 3 for forecasting.`);
      }

      // Anti-pattern trends
      const apTrends = kb.getAntiPatternTrends(project.id);

      // Linear regression on score over time
      const trend = this.calculateTrend(history);

      // Top recurring anti-patterns
      const recurringAP = this.findRecurringPatterns(apTrends);

      // Risk assessment
      const risks: string[] = [];
      if (trend.trend === 'degrading') {
        risks.push(`Score declining at ${Math.abs(trend.slope).toFixed(2)} points/day`);
      }
      if (trend.projected30d < 60) {
        risks.push(`Projected score in 30 days: ${trend.projected30d.toFixed(1)} (below acceptable threshold)`);
      }
      if (recurringAP.length > 0) {
        risks.push(`${recurringAP.length} anti-patterns recurring across multiple analyses`);
      }

      const summary = risks.length === 0
        ? `Architecture trend is ${trend.trend}. Score projected at ${trend.projected30d.toFixed(1)} in 30 days.`
        : `⚠ ${risks.length} risks detected. ${risks[0]!}`;

      return {
        agentId: this.metadata.id,
        success: true,
        summary,
        data: {
          currentScore: history[history.length - 1]!.overall,
          historyLength: history.length,
          trend: {
            direction: trend.trend,
            slopePerDay: Number(trend.slope.toFixed(4)),
            rSquared: Number(trend.rSquared.toFixed(4)),
            projected30d: Number(trend.projected30d.toFixed(1)),
            projected90d: Number(trend.projected90d.toFixed(1)),
          },
          recurringAntiPatterns: recurringAP,
          risks,
        },
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    } finally {
      kb.close();
    }
  }

  /**
   * Simple linear regression: score = slope * dayIndex + intercept
   */
  private calculateTrend(history: ScorePoint[]): TrendResult {
    const n = history.length;
    const timestamps = history.map(h => new Date(h.timestamp).getTime());
    const minT = timestamps[0]!;
    const msPerDay = 86400000;

    // Convert to day indices
    const xs = timestamps.map(t => (t - minT) / msPerDay);
    const ys = history.map(h => h.overall);

    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((a, x, i) => a + x * ys[i]!, 0);
    const sumXX = xs.reduce((a, x) => a + x * x, 0);

    const denom = n * sumXX - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;

    // R² (coefficient of determination)
    const meanY = sumY / n;
    const ssRes = ys.reduce((a, y, i) => a + (y - (slope * xs[i]! + intercept)) ** 2, 0);
    const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
    const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    const lastDayIndex = xs[xs.length - 1]!;
    const projected30d = Math.max(0, Math.min(100, slope * (lastDayIndex + 30) + intercept));
    const projected90d = Math.max(0, Math.min(100, slope * (lastDayIndex + 90) + intercept));

    let trend: 'improving' | 'stable' | 'degrading';
    if (slope > 0.1) trend = 'improving';
    else if (slope < -0.1) trend = 'degrading';
    else trend = 'stable';

    return { slope, intercept, rSquared, projected30d, projected90d, trend };
  }

  private findRecurringPatterns(
    apTrends: Array<{ name: string; occurrences: number; severity: string }>
  ): Array<{ name: string; occurrences: number; severity: string }> {
    return apTrends
      .filter(t => t.occurrences >= 3)
      .sort((a, b) => b.occurrences - a.occurrences)
      .map(t => ({ name: t.name, occurrences: t.occurrences, severity: t.severity }));
  }

  private fail(start: number, message: string): AgentResult {
    return {
      agentId: this.metadata.id,
      success: false,
      summary: message,
      data: {},
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}
