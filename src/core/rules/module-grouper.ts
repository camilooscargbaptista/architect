import { basename, dirname, join } from 'path';
import { AnalysisReport } from '../types/core.js';
import { RefactorRule, RefactorStep, FileOperation } from '../types/rules.js';

/**
 * Module Grouper Rule (Tier 1)
 * Analyzes which files are frequently imported together and suggests
 * grouping them into cohesive modules/packages.
 */
export class ModuleGrouperRule implements RefactorRule {
  name = 'module-grouper';
  tier = 1 as const;

  analyze(report: AnalysisReport, _projectPath: string): RefactorStep[] {
    const steps: RefactorStep[] = [];

    // Build co-import matrix: which files are imported together?
    const coImportCount: Record<string, Record<string, number>> = {};

    // For each source file, see what it imports
    const importsBySource: Record<string, string[]> = {};
    for (const edge of report.dependencyGraph.edges) {
      if (!importsBySource[edge.from]) importsBySource[edge.from] = [];
      importsBySource[edge.from].push(edge.to);
    }

    // Count co-imports
    for (const [_source, targets] of Object.entries(importsBySource)) {
      for (let i = 0; i < targets.length; i++) {
        for (let j = i + 1; j < targets.length; j++) {
          const a = targets[i];
          const b = targets[j];
          if (!coImportCount[a]) coImportCount[a] = {};
          if (!coImportCount[b]) coImportCount[b] = {};
          coImportCount[a][b] = (coImportCount[a][b] || 0) + 1;
          coImportCount[b][a] = (coImportCount[b][a] || 0) + 1;
        }
      }
    }

    // Find clusters: files that are always imported together
    const clusters: Array<{ files: string[]; coImportScore: number }> = [];
    const visited = new Set<string>();

    for (const [fileA, partners] of Object.entries(coImportCount)) {
      if (visited.has(fileA)) continue;

      const strongPartners = Object.entries(partners)
        .filter(([_, count]) => count >= 3)
        .sort((a, b) => b[1] - a[1]);

      if (strongPartners.length >= 2) {
        const cluster = [fileA, ...strongPartners.map(([f]) => f)];
        const inSameDir = cluster.every(
          (f) => dirname(f) === dirname(cluster[0])
        );

        // Only suggest if NOT already in the same directory
        if (!inSameDir) {
          // Arquitetura Limpa: Impede arrastar Módulos Transversais (DTOs/Types) para se tornarem fechados em Pastas de Domínios
          const hasTypes = cluster.some(f => {
            const lowerF = f.toLowerCase();
            return lowerF.includes('types') || lowerF.includes('interface') || lowerF.includes('/types/');
          });
          if (hasTypes) continue;

          const score = strongPartners.reduce((sum, [_, c]) => sum + c, 0);
          clusters.push({ files: cluster, coImportScore: score });
          cluster.forEach((f) => visited.add(f));
        }
      }
    }

    // Generate steps for each cluster
    for (const cluster of clusters.slice(0, 3)) {
      const operations: FileOperation[] = [];
      const clusterName = this.suggestModuleName(cluster.files);
      const targetDir = `${dirname(cluster.files[0])}/${clusterName}`;

      // Create new module directory
      operations.push({
        type: 'CREATE',
        path: `${targetDir}/__init__.py`,
        description: `Create new module \`${clusterName}/\` to group ${cluster.files.length} co-dependent files`,
        content: `"""Module ${clusterName} — grouped by co-import pattern."""\n`,
      });

      // Move files
      for (const file of cluster.files) {
        const newPath = join(targetDir, basename(file));
        operations.push({
          type: 'MOVE',
          path: file,
          newPath,
          description: `Move \`${basename(file)}\` → \`${clusterName}/${basename(file)}\``,
        });
      }

      steps.push({
        id: 0,
        tier: 1,
        rule: this.name,
        priority: 'MEDIUM',
        title: `Group co-dependent files into \`${clusterName}/\``,
        description: `Files ${cluster.files.map((f) => `\`${basename(f)}\``).join(', ')} ` +
          `are frequently imported together (co-import score: ${cluster.coImportScore}). ` +
          `Grouping them improves cohesion.`,
        rationale: `Files that are frequently imported together belong in the same module. ` +
          `This improves discoverability and reduces the cognitive load of understanding ` +
          `which files work together.`,
        operations,
        scoreImpact: [
          { metric: 'cohesion', before: report.score.breakdown.cohesion, after: Math.min(95, report.score.breakdown.cohesion + 10) },
          { metric: 'modularity', before: report.score.breakdown.modularity, after: Math.min(95, report.score.breakdown.modularity + 5) },
        ],
        aiPrompt: `Analyze the files: ${cluster.files.map(f => `\`${f}\``).join(', ')}.\nThese files are frequently imported together but are currently scattered across different directories.\nPlease refactor to improve cohesion:\n1. Create a new directory named \`${targetDir}\`.\n2. Move these files solidly into this new directory.\n3. Add an index/barrel file if appropriate.\n4. Securely scan the entire project to fix all broken imports resulting from this move.`,
      });
    }

    return steps;
  }

  private suggestModuleName(files: string[]): string {
    // Try to infer a common theme from filenames
    const names = files.map((f) => basename(f).replace(/\.[^.]+$/, '').toLowerCase());
    const commonParts = names[0].split(/[_-]/).filter((part) =>
      names.every((n) => n.includes(part))
    );

    if (commonParts.length > 0) return commonParts[0];
    return 'shared';
  }
}
