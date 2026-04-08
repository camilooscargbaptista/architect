/**
 * Refactor Agent
 *
 * Autonomous refactoring agent that combines the RefactorEngine analysis
 * with the AgentExecutor runtime. Integrates with KB for persistence
 * and EventBus for self-improving loop integration.
 *
 * Capabilities: refactor
 *
 * @since v10.0.0 — Phase 2B
 */

import { resolve } from 'path';
import { existsSync } from 'fs';
import { BaseArchitectureAgent } from './base-agent.js';
import type { AgentContext, AgentResult, AgentMetadata } from './types.js';

export class RefactorAgent extends BaseArchitectureAgent {
  readonly metadata: AgentMetadata = {
    id: 'refactor-agent',
    name: 'Architecture Refactor Agent',
    description: 'Generates and optionally executes refactoring plans to improve architecture score.',
    capabilities: ['refactor'],
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
      { RefactorEngine },
      { ConfigLoader },
      { ProjectScanner },
      { resolveProfile, mergeWeights },
    ] = await Promise.all([
      import('@girardelli/architect-core/src/core/analyzer.js'),
      import('@girardelli/architect-core/src/core/scorer.js'),
      import('@girardelli/architect-core/src/core/anti-patterns.js'),
      import('@girardelli/architect-core/src/core/refactor-engine.js'),
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
    const layers = analyzer.detectLayers(projectInfo.fileTree);

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

    const nodes = Array.from(new Set([...edges.map(e => e.from), ...edges.map(e => e.to)]));

    const report = {
      timestamp: new Date().toISOString(),
      projectInfo,
      score,
      antiPatterns,
      layers,
      dependencyGraph: { nodes, edges },
      suggestions: [],
      diagram: { mermaid: '', type: 'dependency' as const },
    };

    // 2. Generate refactoring plan
    const engine = new RefactorEngine();
    const plan = engine.analyze(report as any, absPath);

    if (plan.steps.length === 0) {
      return {
        agentId: this.metadata.id,
        success: true,
        summary: `No refactoring needed. Score: ${score.overall}/100`,
        data: { currentScore: score.overall, steps: 0 },
        durationMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    }

    // 3. Execute if autoMode
    let executionResult: { executed: boolean; stepsApplied: number } = {
      executed: false,
      stepsApplied: 0,
    };

    if (context.autoMode) {
      try {
        const { AgentExecutor } = await import('../agent-runtime/executor.js');
        const executor = new AgentExecutor(true);
        await executor.executePlan(plan, context.providerType);
        executionResult = { executed: true, stepsApplied: plan.steps.length };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.log(`Execution failed: ${message}`);
        executionResult = { executed: false, stepsApplied: 0 };
      }
    }

    // 4. Persist to KB
    try {
      const { KnowledgeBase } = await import(
        '@girardelli/architect-core/src/core/knowledge-base/knowledge-base.js'
      );
      const kb = new KnowledgeBase(absPath);
      try {
        kb.persistAnalysis(report as any);
      } finally {
        kb.close();
      }
    } catch {
      // KB persistence is best-effort
    }

    const improvement = plan.estimatedScoreAfter.overall - plan.currentScore.overall;

    return {
      agentId: this.metadata.id,
      success: true,
      summary: executionResult.executed
        ? `Applied ${executionResult.stepsApplied} refactoring steps. Estimated improvement: +${improvement.toFixed(1)}`
        : `Generated ${plan.steps.length} refactoring steps. Estimated improvement: +${improvement.toFixed(1)}. Run with --auto to apply.`,
      data: {
        currentScore: plan.currentScore.overall,
        estimatedScoreAfter: plan.estimatedScoreAfter.overall,
        improvement,
        totalSteps: plan.steps.length,
        totalOperations: plan.totalOperations,
        executed: executionResult.executed,
        stepsApplied: executionResult.stepsApplied,
        steps: plan.steps.map(s => ({
          id: s.id,
          tier: s.tier,
          rule: s.rule,
          priority: s.priority,
          title: s.title,
          operationCount: s.operations.length,
          scoreImpact: s.scoreImpact,
        })),
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
