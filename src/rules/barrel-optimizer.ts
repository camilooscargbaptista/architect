import { basename, dirname } from 'path';
import { AnalysisReport, RefactorRule, RefactorStep, FileOperation } from '../types.js';

/**
 * Barrel Optimizer Rule (Tier 1)
 * Analyzes barrel files (__init__.py, index.ts) and suggests optimization.
 * Barrel files that re-export everything create unnecessary coupling.
 */
export class BarrelOptimizerRule implements RefactorRule {
  name = 'barrel-optimizer';
  tier = 1 as const;

  private static readonly BARREL_FILES = new Set([
    '__init__.py', 'index.ts', 'index.js', 'index.tsx', 'index.jsx',
  ]);

  analyze(report: AnalysisReport, projectPath: string): RefactorStep[] {
    const steps: RefactorStep[] = [];

    // Find barrel files in the dependency graph
    const barrelNodes = report.dependencyGraph.nodes.filter((n) =>
      BarrelOptimizerRule.BARREL_FILES.has(basename(n))
    );

    for (const barrel of barrelNodes) {
      // Count how many things this barrel re-exports (outgoing edges)
      const outgoing = report.dependencyGraph.edges.filter(
        (e) => e.from === barrel
      );
      const incoming = report.dependencyGraph.edges.filter(
        (e) => e.to === barrel
      );

      if (outgoing.length < 3) continue;

      // Check for "pass-through" pattern: files import from barrel
      // but barrel just re-exports from siblings
      const siblingDir = dirname(barrel);
      const siblingExports = outgoing.filter(
        (e) => dirname(e.to) === siblingDir
      );

      const operations: FileOperation[] = [];

      // Suggest direct imports instead of barrel
      for (const consumer of incoming) {
        const consumedModules = outgoing
          .filter((e) => {
            // Check if consumer actually needs this module
            return report.dependencyGraph.edges.some(
              (edge) => edge.from === consumer.from && edge.to === e.to
            );
          })
          .map((e) => e.to);

        if (consumedModules.length > 0) {
          operations.push({
            type: 'MODIFY',
            path: consumer.from,
            description: `Replace barrel import from \`${basename(barrel)}\` with direct imports: ${consumedModules.map((m) => basename(m)).join(', ')}`,
          });
        }
      }

      // Suggest simplifying the barrel
      if (siblingExports.length > 5) {
        operations.push({
          type: 'MODIFY',
          path: barrel,
          description: `Simplify ${basename(barrel)}: only re-export public API (${siblingExports.length} re-exports detected, consider reducing)`,
        });
      }

      if (operations.length > 0) {
        steps.push({
          id: 0,
          tier: 1,
          rule: this.name,
          priority: outgoing.length >= 8 ? 'HIGH' : 'MEDIUM',
          title: `Optimize barrel: ${barrel}`,
          description: `\`${barrel}\` re-exports ${outgoing.length} modules. ` +
            `This creates a "Shotgun Surgery" risk — any change propagates widely.`,
          rationale: `Barrel files that re-export everything make it hard to tree-shake unused code ` +
            `and create implicit dependencies. Direct imports make dependency relationships explicit ` +
            `and reduce the blast radius of changes.`,
          operations,
          scoreImpact: [
            { metric: 'coupling', before: report.score.breakdown.coupling, after: Math.min(95, report.score.breakdown.coupling + 10) },
            { metric: 'layering', before: report.score.breakdown.layering, after: Math.min(95, report.score.breakdown.layering + 5) },
          ],
        });
      }
    }

    return steps;
  }
}
