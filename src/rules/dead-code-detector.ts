import { basename } from 'path';
import { AnalysisReport, RefactorRule, RefactorStep, FileOperation } from '../types.js';

/**
 * Dead Code Detector Rule (Tier 1)
 * Finds files with no incoming edges (nobody imports them)
 * and exports that are never used.
 * 
 * Handles both path-style (deepguard/report.py) and
 * dot-notation (deepguard.report) references.
 */
export class DeadCodeDetectorRule implements RefactorRule {
  name = 'dead-code-detector';
  tier = 1 as const;

  private static readonly ENTRY_POINTS = new Set([
    'main.py', 'cli.py', 'app.py', 'manage.py', 'wsgi.py', 'asgi.py',
    'main.ts', 'main.js', 'app.ts', 'app.js', 'server.ts', 'server.js',
    'index.html', 'setup.py', 'setup.cfg', 'pyproject.toml',
  ]);

  analyze(report: AnalysisReport, projectPath: string): RefactorStep[] {
    const steps: RefactorStep[] = [];
    const edges = report.dependencyGraph.edges;

    // Build a set of ALL referenced targets (both path and dot-notation)
    const allTargets = new Set<string>();
    const allSources = new Set<string>();
    for (const edge of edges) {
      allTargets.add(edge.to);
      allSources.add(edge.from);
    }

    // Only consider actual files (with path separators) as candidates
    const fileNodes = report.dependencyGraph.nodes.filter(
      (n) => n.includes('/') || n.includes('\\')
    );

    // Build incoming edge count considering dot-notation matches
    const incomingCount: Record<string, number> = {};

    for (const file of fileNodes) {
      incomingCount[file] = 0;

      // Direct incoming edges
      for (const edge of edges) {
        if (edge.to === file) {
          incomingCount[file]++;
        }
      }

      // Check dot-notation references:
      // deepguard/report.py might be referenced as deepguard.report or .report
      const dotVariants = this.getDotVariants(file);
      for (const variant of dotVariants) {
        if (allTargets.has(variant)) {
          incomingCount[file]++;
        }
      }
    }

    // Find orphan files
    const orphans: string[] = [];

    for (const [file, count] of Object.entries(incomingCount)) {
      const fileName = basename(file);

      // Skip entry points and config files
      if (DeadCodeDetectorRule.ENTRY_POINTS.has(fileName)) continue;
      if (fileName.startsWith('__')) continue;
      if (fileName.startsWith('.')) continue;
      if (fileName.endsWith('.test.ts') || fileName.endsWith('.spec.ts')) continue;
      if (fileName.endsWith('_test.py') || fileName.endsWith('.test.py')) continue;

      // Also skip if the file has outgoing edges (it's active code)
      if (allSources.has(file)) continue;

      if (count === 0) {
        orphans.push(file);
      }
    }

    if (orphans.length > 0) {
      const operations: FileOperation[] = orphans.map((file) => ({
        type: 'DELETE' as const,
        path: file,
        description: `\`${basename(file)}\` has no incoming dependencies — verify if still needed`,
      }));

      steps.push({
        id: 0,
        tier: 1,
        rule: this.name,
        priority: orphans.length >= 3 ? 'MEDIUM' : 'LOW',
        title: `Review ${orphans.length} potentially unused file(s)`,
        description: `Found ${orphans.length} file(s) with no incoming dependencies: ` +
          `${orphans.map((f) => `\`${basename(f)}\``).join(', ')}. ` +
          `These may be dead code or missing from the module's public API.`,
        rationale: `Files with zero incoming edges are either entry points (already excluded), ` +
          `or potentially dead code. Removing dead code reduces maintenance burden ` +
          `and improves modularity scores.`,
        operations,
        scoreImpact: [
          { metric: 'modularity', before: report.score.breakdown.modularity, after: Math.min(95, report.score.breakdown.modularity + 5) },
        ],
      });
    }

    return steps;
  }

  /**
   * Generate dot-notation variants for a file path.
   * "deepguard/report.py" → ["deepguard.report", ".report"]
   */
  private getDotVariants(filePath: string): string[] {
    const variants: string[] = [];
    const withoutExt = filePath.replace(/\.[^.]+$/, '');
    const dotPath = withoutExt.replace(/[/\\]/g, '.');

    variants.push(dotPath);

    // Relative dot-notation: .report
    const parts = filePath.split('/');
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1].replace(/\.[^.]+$/, '');
      variants.push(`.${lastPart}`);
    }

    return variants;
  }
}
