import { basename, dirname } from 'path';
import { AnalysisReport } from '../types/core.js';
import { RefactorRule, RefactorStep, FileOperation } from '../types/rules.js';

/**
 * Import Organizer Rule (Tier 1)
 * Detects files that import from too many different modules (cross-boundary).
 * Suggests dependency injection or facade patterns.
 */
export class ImportOrganizerRule implements RefactorRule {
  name = 'import-organizer';
  tier = 1 as const;

  analyze(report: AnalysisReport, projectPath: string): RefactorStep[] {
    const steps: RefactorStep[] = [];

    // Find files that import from many different directories
    const crossBoundary: Record<string, { targets: Set<string>; dirs: Set<string> }> = {};

    for (const edge of report.dependencyGraph.edges) {
      const fromDir = dirname(edge.from);
      const toDir = dirname(edge.to);

      if (!crossBoundary[edge.from]) {
        crossBoundary[edge.from] = { targets: new Set(), dirs: new Set() };
      }
      crossBoundary[edge.from].targets.add(edge.to);

      if (fromDir !== toDir) {
        crossBoundary[edge.from].dirs.add(toDir);
      }
    }

    // Outliers reais espalhados consumindo +5 diretórios. Testa bypass em unit-tests (.test.) naturais de altíssima injeção (mock).
    const violators = Object.entries(crossBoundary)
      .filter(([fileName, data]) => data.dirs.size >= 5 && !fileName.includes('.test.'))
      .sort((a, b) => b[1].dirs.size - a[1].dirs.size);

    for (const [file, data] of violators) {
      const operations: FileOperation[] = [];
      const fileName = basename(file);
      const fileDir = dirname(file);

      // Suggest creating a facade/service layer
      const ext = fileName.split('.').pop() || 'py';
      const nameBase = fileName.replace(/\.[^.]+$/, '');
      const facadePath = `${fileDir}/${nameBase}_deps.${ext}`;

      operations.push({
        type: 'CREATE',
        path: facadePath,
        description: `Create dependency facade \`${basename(facadePath)}\` — centralizes ${data.dirs.size} cross-module imports`,
        content: this.generateFacadeContent(ext, Array.from(data.targets), Array.from(data.dirs)),
      });

      operations.push({
        type: 'MODIFY',
        path: file,
        description: `Refactor \`${fileName}\` to import from local facade instead of ${data.dirs.size} different modules`,
      });

      steps.push({
        id: 0,
        tier: 1,
        rule: this.name,
        priority: data.dirs.size >= 5 ? 'HIGH' : 'MEDIUM',
        title: `Reduce cross-boundary imports: ${fileName}`,
        description: `\`${file}\` imports from ${data.dirs.size} different modules: ` +
          `${Array.from(data.dirs).map((d) => `\`${d}\``).join(', ')}. ` +
          `Consider using a facade or dependency injection.`,
        rationale: `Files with imports scattered across many modules have high afferent coupling. ` +
          `A facade centralizes these dependencies, making the file easier to test (mock one facade) ` +
          `and reducing the impact of changes in dependent modules.`,
        operations,
        scoreImpact: [
          { metric: 'cohesion', before: report.score.breakdown.cohesion, after: Math.min(95, report.score.breakdown.cohesion + 5) },
          { metric: 'coupling', before: report.score.breakdown.coupling, after: Math.min(95, report.score.breakdown.coupling + 5) },
        ],
        aiPrompt: `Analyze the file \`${file}\` which currently imports from ${data.dirs.size} cross-boundary distinct directories/modules (${Array.from(data.dirs).join(', ')}).\nPlease refactor this to use the Dependency Injection (DI) or Facade pattern:\n1. Extract these imports into a dedicated file \`${facadePath}\`.\n2. Re-export or bundle them appropriately.\n3. Update \`${file}\` to import strictly from the new \`${facadePath}\` rather than directly reaching into multiple disjointed modules, lowering its afferent coupling.`,
      });
    }

    return steps;
  }

  private generateFacadeContent(ext: string, targets: string[], dirs: string[]): string {
    if (ext === 'py') {
      const imports = targets
        .map((t) => `# from ${t.replace(/\//g, '.')} import ...`)
        .join('\n');
      return `"""Dependency facade — centralizes cross-module imports."""\n\n${imports}\n\n# Re-export what ${dirs.length} modules need\n`;
    }

    // JS/TS
    const imports = targets
      .map((t) => `// export { ... } from '${t}';`)
      .join('\n');
    return `/**\n * Dependency facade — centralizes cross-module imports.\n */\n\n${imports}\n`;
  }
}
