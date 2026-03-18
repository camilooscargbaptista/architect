import { readFileSync } from 'fs';
import { basename, dirname, join, relative } from 'path';
import {
  AnalysisReport,
  RefactoringPlan,
  RefactorStep,
  RefactorRule,
  FileOperation,
} from './types.js';

// ── Tier 1 Rules ──
import { HubSplitterRule } from './rules/hub-splitter.js';
import { BarrelOptimizerRule } from './rules/barrel-optimizer.js';
import { ImportOrganizerRule } from './rules/import-organizer.js';
import { ModuleGrouperRule } from './rules/module-grouper.js';
import { DeadCodeDetectorRule } from './rules/dead-code-detector.js';

/**
 * Refactoring Engine v2.0
 * Orchestrates Tier 1 (rule-based) and Tier 2 (AST) refactoring rules.
 */
export class RefactorEngine {
  private rules: RefactorRule[];

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
   * Analyze a project and generate a refactoring plan.
   */
  analyze(report: AnalysisReport, projectPath: string): RefactoringPlan {
    const allSteps: RefactorStep[] = [];
    let stepId = 1;

    // Run each rule
    for (const rule of this.rules) {
      const steps = rule.analyze(report, projectPath);
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
    allSteps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Re-number after sorting
    allSteps.forEach((s, i) => (s.id = i + 1));

    // Calculate total operations
    const totalOperations = allSteps.reduce(
      (sum, s) => sum + s.operations.length,
      0
    );

    // Estimate score after refactoring
    const estimatedScoreAfter = this.estimateScoreAfter(report, allSteps);

    return {
      timestamp: new Date().toISOString(),
      projectPath,
      currentScore: report.score,
      estimatedScoreAfter,
      steps: allSteps,
      totalOperations,
      tier1Steps: allSteps.filter((s) => s.tier === 1).length,
      tier2Steps: allSteps.filter((s) => s.tier === 2).length,
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
