/**
 * Review Agent
 *
 * Analyzes the current project state against architecture rules and KB history.
 * Produces a structured review with score impact, rule violations, and recommendations.
 *
 * Capabilities: review, audit
 *
 * @since v10.0.0 — Phase 2B
 */

import { resolve } from 'path';
import { existsSync } from 'fs';
import { BaseArchitectureAgent } from './base-agent.js';
import type { AgentContext, AgentResult, AgentMetadata } from './types.js';

export class ReviewAgent extends BaseArchitectureAgent {
  readonly metadata: AgentMetadata = {
    id: 'review-agent',
    name: 'Architecture Review Agent',
    description: 'Reviews project architecture against rules and KB history. Detects regressions and violations.',
    capabilities: ['review', 'audit'],
    version: '10.0.0',
  };

  async preflight(context: AgentContext): Promise<string | null> {
    const absPath = resolve(context.projectPath);
    if (!existsSync(absPath)) {
      return `Project path does not exist: ${absPath}`;
    }
    return null;
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const absPath = resolve(context.projectPath);

    const [
      { ArchitectureAnalyzer },
      { ArchitectureScorer },
      { AntiPatternDetector },
      { RulesEngine },
      { KnowledgeBase },
      { ConfigLoader },
      { ProjectScanner },
      { resolveProfile, mergeWeights },
    ] = await Promise.all([
      import('@girardelli/architect-core/src/core/analyzer.js'),
      import('@girardelli/architect-core/src/core/scorer.js'),
      import('@girardelli/architect-core/src/core/anti-patterns.js'),
      import('@girardelli/architect-core/src/core/rules-engine.js'),
      import('@girardelli/architect-core/src/core/knowledge-base/knowledge-base.js'),
      import('@girardelli/architect-core/src/core/config.js'),
      import('@girardelli/architect-core/src/infrastructure/scanner.js'),
      import('@girardelli/architect-core/src/core/scoring-profiles.js'),
    ]);

    // 1. Run analysis
    const config = ConfigLoader.loadConfig(absPath);
    const scanner = new ProjectScanner(absPath, config);
    const projectInfo = scanner.scan();

    if (!projectInfo.fileTree) {
      return this.fail(start, 'Failed to scan project — no file tree');
    }

    const analyzer = new ArchitectureAnalyzer(absPath);
    await analyzer.initialize();
    const edges = analyzer.analyzeDependencies(projectInfo.fileTree);

    const dependencies = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!dependencies.has(edge.from)) dependencies.set(edge.from, new Set());
      dependencies.get(edge.from)!.add(edge.to);
    }

    const detector = new AntiPatternDetector(config);
    const antiPatterns = await detector.detect(projectInfo.fileTree, dependencies);

    const profile = resolveProfile({
      frameworks: projectInfo.frameworks,
      languages: projectInfo.primaryLanguages,
    });
    const weights = mergeWeights(profile, config.score);
    const scorer = new ArchitectureScorer(weights, profile.thresholds, profile.name);
    const score = scorer.score(edges, antiPatterns, projectInfo.totalFiles);

    // 2. Check rules if available
    let ruleViolations: Array<{ level: string; rule: string; message: string }> = [];
    try {
      const { readFileSync } = await import('fs');
      const { join } = await import('path');
      const yaml = await import('yaml');
      const rulesPath = join(absPath, '.architect.rules.yml');
      if (existsSync(rulesPath)) {
        const rules = yaml.parse(readFileSync(rulesPath, 'utf8'));
        const engine = new RulesEngine();
        const report = {
          timestamp: new Date().toISOString(),
          projectInfo,
          score,
          antiPatterns,
          layers: [],
          dependencyGraph: { nodes: [], edges },
          suggestions: [],
          diagram: { mermaid: '', type: 'dependency' as const },
        };
        const result = engine.validate(report as any, rules);
        ruleViolations = result.violations;
      }
    } catch {
      // No rules file — that's fine
    }

    // 3. KB comparison (score delta)
    let scoreDelta: number | null = null;
    let previousScore: number | null = null;
    try {
      const kb = new KnowledgeBase(absPath);
      try {
        const project = kb.getProjectByPath(absPath);
        if (project) {
          const delta = kb.getScoreDelta(project.id);
          if (delta) {
            scoreDelta = delta.delta;
            previousScore = delta.previous;
          }
        }
      } finally {
        kb.close();
      }
    } catch {
      // KB not available
    }

    // 4. Build review
    const criticalAP = antiPatterns.filter(a => a.severity === 'CRITICAL');
    const highAP = antiPatterns.filter(a => a.severity === 'HIGH');

    const issues: string[] = [];
    if (criticalAP.length > 0) issues.push(`${criticalAP.length} CRITICAL anti-patterns`);
    if (highAP.length > 0) issues.push(`${highAP.length} HIGH anti-patterns`);
    if (ruleViolations.length > 0) issues.push(`${ruleViolations.length} rule violations`);
    if (scoreDelta !== null && scoreDelta < -5) issues.push(`Score regressed by ${Math.abs(scoreDelta)} points`);

    const verdict = issues.length === 0
      ? 'PASS — Architecture is healthy'
      : `NEEDS ATTENTION — ${issues.join(', ')}`;

    return {
      agentId: this.metadata.id,
      success: true,
      summary: verdict,
      data: {
        score: score.overall,
        breakdown: score.breakdown,
        profile: profile.name,
        previousScore,
        scoreDelta,
        antiPatterns: {
          total: antiPatterns.length,
          critical: criticalAP.length,
          high: highAP.length,
          medium: antiPatterns.filter(a => a.severity === 'MEDIUM').length,
          low: antiPatterns.filter(a => a.severity === 'LOW').length,
        },
        ruleViolations: ruleViolations.map(v => ({
          level: v.level,
          rule: v.rule,
          message: v.message,
        })),
        issues,
        verdict: issues.length === 0 ? 'pass' : 'fail',
      },
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
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
