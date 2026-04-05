import { AnalysisReport, buildDependencyIndex, DependencyIndex } from './types/core.js';
import { RefactoringPlan, RefactorStep, RefactorRule } from './types/rules.js';
import { isExternalDependency, detectLanguage } from './utils/stdlib-registry.js';
import { GenesisValidator } from './genesis-validator.js';

// ── Tier 1 Rules ──
import { HubSplitterRule } from './rules/hub-splitter.js';
import { BarrelOptimizerRule } from './rules/barrel-optimizer.js';
import { ImportOrganizerRule } from './rules/import-organizer.js';
import { ModuleGrouperRule } from './rules/module-grouper.js';
import { DeadCodeDetectorRule } from './rules/dead-code-detector.js';

/**
 * Describes which files were affected by a refactoring step,
 * enabling partial re-analysis scoped to only those files.
 *
 * @since v9.0 — Fase 3.3
 */
export interface AffectedScope {
  /** Files that were created, modified, moved-to, or deleted */
  changedFiles: string[];
  /** All files that import any of the changed files (potential stale edges) */
  consumerFiles: string[];
}

/**
 * Refactoring Engine v2.3
 * Orchestrates Tier 1 (rule-based) and Tier 2 (AST) refactoring rules.
 *
 * v8.2.0 — Fase 2.1: Centralized external dependency filtering.
 * v9.0   — Fase 3.3: Partial re-analysis via computeAffectedScope().
 * v9.0   — Fase 3.4: Plugin-provided custom refactoring rules.
 *
 * All rules receive a pre-cleaned dependency graph with stdlib,
 * vendor, and npm packages removed. This eliminates duplicated
 * filtering logic across rules and protects future rules automatically.
 */
export class RefactorEngine {
  private rules: RefactorRule[];
  private pluginRules: RefactorRule[] = [];

  constructor() {
    this.rules = [
      // Tier 1: Rule Engine (pattern matching)
      new HubSplitterRule(),
      new BarrelOptimizerRule(),
      new ImportOrganizerRule(),
      new ModuleGrouperRule(),
      new DeadCodeDetectorRule(),
    ];
  }

  /**
   * Register additional refactoring rules from plugins.
   * Plugin rules run after built-in rules in the analysis pipeline.
   *
   * @since v9.0 — Fase 3.4
   */
  registerPluginRules(rules: RefactorRule[]): void {
    this.pluginRules.push(...rules);
  }

  /**
   * Get the total number of registered rules (built-in + plugin).
   */
  getRuleCount(): number {
    return this.rules.length + this.pluginRules.length;
  }

  /**
   * Analyze a project and generate a refactoring plan.
   */
  analyze(report: AnalysisReport, projectPath: string): RefactoringPlan {
    // ── Fase 2.1: Pre-clean external dependencies from graph ──
    // All rules receive a graph containing ONLY internal project files.
    const cleanedReport = this.filterExternalDependencies(report);

    // ── Fase 2.6: Pre-compute dependency index in a single O(E) pass ──
    // All rules receive the index for O(1) per-file lookups instead of
    // redundant O(E) scans. Net effect: O(R×E) → O(E) for edge traversal.
    const index = buildDependencyIndex(cleanedReport.dependencyGraph.edges);

    const allSteps: RefactorStep[] = [];
    let stepId = 1;

    // Run each rule against the cleaned graph + pre-computed index
    // Built-in rules first, then plugin-provided rules (Fase 3.4)
    const allRules = [...this.rules, ...this.pluginRules];
    for (const rule of allRules) {
      const steps = rule.analyze(cleanedReport, projectPath, index);
      for (const step of steps) {
        step.id = stepId++;
        allSteps.push(step);
      }
    }

    // Sort by priority
    const priorityOrder: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 1,
      MEDIUM: 2,
      LOW: 3,
    };
    allSteps.sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

    // Re-number after sorting
    allSteps.forEach((s, i) => (s.id = i + 1));

    // Calculate total operations
    const totalOperations = allSteps.reduce(
      (sum, s) => sum + s.operations.length,
      0
    );

    // Estimate score after refactoring
    const estimatedScoreAfter = this.estimateScoreAfter(report, allSteps);

    const plan: RefactoringPlan = {
      timestamp: new Date().toISOString(),
      projectPath,
      currentScore: report.score,
      estimatedScoreAfter,
      steps: allSteps,
      totalOperations,
      tier1Steps: allSteps.filter((s) => s.tier === 1).length,
      tier2Steps: allSteps.filter((s) => s.tier === 2).length,
    };

    // ── Fase 3.5: Validate plan consistency before returning ──
    const projectFiles = new Set(cleanedReport.dependencyGraph.nodes);
    const validationResult = new GenesisValidator().validate(plan, projectFiles);
    plan.validation = {
      valid: validationResult.valid,
      errorCount: validationResult.errorCount,
      warningCount: validationResult.warningCount,
      issues: validationResult.issues.map(i => ({
        severity: i.severity,
        category: i.category,
        stepId: i.stepId,
        message: i.message,
      })),
    };

    return plan;
  }

  /**
   * Pre-processes the dependency graph by removing external dependencies
   * (stdlib, vendor, npm packages) from both nodes and edges.
   *
   * This ensures all rules operate on a clean internal-only graph without
   * needing to implement their own filtering — protecting both existing
   * and future rules from the "forgot to filter" class of bugs.
   */
  private filterExternalDependencies(report: AnalysisReport): AnalysisReport {
    const language = detectLanguage(report.projectInfo);
    const projectFiles = new Set(report.dependencyGraph.nodes);

    const cleanNodes = report.dependencyGraph.nodes.filter(
      node => !isExternalDependency(node, language, projectFiles),
    );

    const cleanEdges = report.dependencyGraph.edges.filter(
      edge =>
        !isExternalDependency(edge.to, language, projectFiles) &&
        !isExternalDependency(edge.from, language, projectFiles),
    );

    return {
      ...report,
      dependencyGraph: {
        nodes: cleanNodes,
        edges: cleanEdges,
      },
    };
  }

  /**
   * Compute the set of files affected by a refactoring step.
   * Used by interactive mode to scope re-analysis to only affected files.
   *
   * Returns:
   * - changedFiles: directly modified/created/deleted/moved files
   * - consumerFiles: files that import any of the changed files
   *
   * @since v9.0 — Fase 3.3
   */
  computeAffectedScope(
    step: RefactorStep,
    index: DependencyIndex,
  ): AffectedScope {
    const changedFiles = new Set<string>();

    for (const op of step.operations) {
      changedFiles.add(op.path);
      if (op.newPath) changedFiles.add(op.newPath);
    }

    // Find consumers: files that import any changed file
    const consumerFiles = new Set<string>();
    for (const file of changedFiles) {
      const incoming = index.incomingByFile.get(file);
      if (incoming) {
        for (const edge of incoming) {
          if (!changedFiles.has(edge.from)) {
            consumerFiles.add(edge.from);
          }
        }
      }
    }

    return {
      changedFiles: [...changedFiles],
      consumerFiles: [...consumerFiles],
    };
  }

  /**
   * Estimates the architecture score after applying all refactoring steps.
   */
  private estimateScoreAfter(
    report: AnalysisReport,
    steps: RefactorStep[]
  ): { overall: number; breakdown: Record<string, number> } {
    const breakdown = { ...report.score.breakdown };

    for (const step of steps) {
      for (const impact of step.scoreImpact) {
        if (impact.metric in breakdown) {
          // Use estimated after value, capped at 95
          const key = impact.metric as keyof typeof breakdown;
          breakdown[key] = Math.min(95, Math.max(breakdown[key], impact.after));
        }
      }
    }

    // Recalculate overall with same weights
    const overall = Math.round(
      breakdown.modularity * 0.4 +
        breakdown.coupling * 0.25 +
        breakdown.cohesion * 0.2 +
        breakdown.layering * 0.15
    );

    return {
      overall: Math.min(100, overall),
      breakdown,
    };
  }
}
