import { AnalysisReport } from './types/core.js';
import { ArchitectRules, RuleViolation, ValidationResult } from './types/architect-rules.js';

export class RulesEngine {
  public validate(report: AnalysisReport, rules: ArchitectRules): ValidationResult {
    const violations: RuleViolation[] = [];

    this.checkQualityGates(report, rules, violations);
    this.checkBoundaries(report, rules, violations);

    return {
      success: violations.every(v => v.level !== 'error'),
      violations,
    };
  }

  private checkQualityGates(report: AnalysisReport, rules: ArchitectRules, violations: RuleViolation[]) {
    if (!rules.quality_gates) return;

    const { min_overall_score, max_critical_anti_patterns, max_high_anti_patterns } = rules.quality_gates;

    // 1. Minimum Overall Score (Error)
    if (min_overall_score !== undefined && report.score.overall < min_overall_score) {
      violations.push({
        level: 'error',
        rule: 'quality_gates.min_overall_score',
        message: `Overall score (${report.score.overall}) is below the minimum required (${min_overall_score}).`,
        actual: report.score.overall,
        expected: min_overall_score,
      });
    }

    // 2. Max Critical Anti-Patterns (Error)
    if (max_critical_anti_patterns !== undefined) {
      const criticalCount = report.antiPatterns.filter(p => p.severity === 'CRITICAL').length;
      if (criticalCount > max_critical_anti_patterns) {
        violations.push({
          level: 'error',
          rule: 'quality_gates.max_critical_anti_patterns',
          message: `Too many CRITICAL anti-patterns detected (${criticalCount}). Maximum allowed is ${max_critical_anti_patterns}.`,
          actual: criticalCount,
          expected: max_critical_anti_patterns,
        });
      }
    }

    // 3. Max High Anti-Patterns (Warning)
    if (max_high_anti_patterns !== undefined) {
      const highCount = report.antiPatterns.filter(p => p.severity === 'HIGH').length;
      if (highCount > max_high_anti_patterns) {
        violations.push({
          level: 'warning',
          rule: 'quality_gates.max_high_anti_patterns',
          message: `High number of HIGH severity anti-patterns (${highCount}). Maximum recommended is ${max_high_anti_patterns}.`,
          actual: highCount,
          expected: max_high_anti_patterns,
        });
      }
    }
  }

  private checkBoundaries(report: AnalysisReport, rules: ArchitectRules, violations: RuleViolation[]) {
    if (!rules.boundaries) return;

    const { allow_circular_dependencies, banned_imports } = rules.boundaries;

    // 1. Allow Circular Dependencies
    if (allow_circular_dependencies === false) {
      const hasCycles = report.antiPatterns.filter(p => p.name === 'Circular Dependency');
      if (hasCycles.length > 0) {
        violations.push({
          level: 'error',
          rule: 'boundaries.allow_circular_dependencies',
          message: `Circular dependencies are strictly forbidden, but ${hasCycles.length} were found.`,
          actual: hasCycles.length,
          expected: 0,
        });
      }
    }

    // 2. Banned Imports (Checks the AST Dependency Graph edges)
    if (banned_imports && banned_imports.length > 0) {
      for (const edge of report.dependencyGraph.edges) {
        // Look through 'to' targets
        for (const banned of banned_imports) {
          if (edge.to.includes(banned)) {
            // Found a banned import!
            violations.push({
              level: 'error',
              rule: 'boundaries.banned_imports',
              message: `Banned import detected: File '${edge.from}' imports '${banned}'.`,
              actual: edge.to,
              expected: `Not to include ${banned}`,
            });
          }
        }
      }
    }
  }
}
