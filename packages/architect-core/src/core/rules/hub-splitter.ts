import { basename, dirname } from 'path';
import { AnalysisReport, DependencyIndex } from '../types/core.js';
import { RefactorRule, RefactorStep, FileOperation } from '../types/rules.js';
import { detectLanguage } from '../utils/stdlib-registry.js';
import { getExtension, getBarrelFilenames, generateSplitFileContent } from '../utils/language-utils.js';

/**
 * Hub Splitter Rule (Tier 1)
 *
 * Detects files with many incoming connections (8+) and generates split plans.
 * A "hub" is a file that many other files depend on, creating tight coupling.
 *
 * v8.2.0 — External dependency filtering is now centralized in RefactorEngine.
 * This rule receives a pre-cleaned graph with only internal project files.
 */
export class HubSplitterRule implements RefactorRule {
  name = 'hub-splitter';
  tier = 1 as const;

  analyze(report: AnalysisReport, _projectPath: string, index?: DependencyIndex): RefactorStep[] {
    const steps: RefactorStep[] = [];
    const language = detectLanguage(report.projectInfo);

    // ── Fase 2.6: Use pre-computed index for O(1) per-file lookups ──
    // Falls back to O(E) scan if index not provided (backward compat).
    const connectionCount: Record<string, { incoming: string[]; outgoing: string[] }> = {};

    if (index) {
      for (const node of report.dependencyGraph.nodes) {
        connectionCount[node] = {
          incoming: (index.incomingByFile.get(node) ?? []).map(e => e.from),
          outgoing: (index.outgoingByFile.get(node) ?? []).map(e => e.to),
        };
      }
    } else {
      for (const edge of report.dependencyGraph.edges) {
        if (!connectionCount[edge.from]) connectionCount[edge.from] = { incoming: [], outgoing: [] };
        if (!connectionCount[edge.to]) connectionCount[edge.to] = { incoming: [], outgoing: [] };
        connectionCount[edge.from]!.outgoing.push(edge.to);
        connectionCount[edge.to]!.incoming.push(edge.from);
      }
    }

    const barrelFiles = getBarrelFilenames(language);

    for (const [file, connections] of Object.entries(connectionCount)) {
      const fileName = basename(file);
      if (barrelFiles.has(fileName)) continue;

      // Ignora Tipos base/DTOs — alto acoplamento em tipos é sinal de maturidade, não gargalo
      const lowerFile = file.toLowerCase();
      if (lowerFile.includes('types') || lowerFile.includes('interface') || lowerFile.includes('/types/')) {
        continue;
      }

      // Tolerância Arquitetural: 8+ dependentes para engatilhar quebra
      if (connections.incoming.length < 8) continue;

      const operations: FileOperation[] = [];

      // Determine if this is a dot-notation module or a real file path
      const isDotNotation = !file.includes('/') && !file.includes('\\');
      const moduleName = isDotNotation
        ? file.split('.').pop() || file
        : fileName.replace(/\.[^.]+$/, '');
      const moduleDir = isDotNotation
        ? file.split('.').slice(0, -1).join('/')
        : dirname(file);

      const ext = fileName.includes('.')
        ? (fileName.split('.').pop() || getExtension(language))
        : getExtension(language);

      // Analyze what dependents import to suggest groupings
      const dependentGroups = this.groupDependents(connections.incoming);

      // Suggest splitting into domain modules
      if (dependentGroups.length >= 2) {
        for (const group of dependentGroups) {
          const newFileName = `${moduleName}_${group.name}.${ext}`;
          const newPath = moduleDir ? `${moduleDir}/${newFileName}` : newFileName;

          operations.push({
            type: 'CREATE',
            path: newPath,
            description: `Create \`${newFileName}\` with functionality used by: ${group.dependents.join(', ')}`,
            content: generateSplitFileContent(language, moduleName, group.name, group.dependents),
          });
        }

        // Update imports in all dependents
        for (const dependent of connections.incoming) {
          operations.push({
            type: 'MODIFY',
            path: dependent,
            description: `Update imports in \`${basename(dependent)}\` to use new split modules`,
          });
        }

        // Mark original for refactoring
        operations.push({
          type: 'MODIFY',
          path: isDotNotation ? `${moduleDir}/${moduleName}.${ext}` : file,
          description: `Refactor \`${moduleName}.${ext}\` — extract grouped functionality to new modules`,
        });
      }

      if (operations.length > 0) {
        steps.push({
          id: 0,
          tier: 1,
          rule: this.name,
          priority: connections.incoming.length >= 8 ? 'CRITICAL' : 'HIGH',
          title: `Split hub file: ${moduleName}.${ext}`,
          description: `\`${file}\` has ${connections.incoming.length} incoming connections. ` +
            `Split into ${dependentGroups.length} focused modules to reduce coupling.`,
          rationale: `High fan-in (${connections.incoming.length} files depend on this) creates a bottleneck. ` +
            `Changes to this file ripple to ${connections.incoming.length} other files. ` +
            `Splitting by usage pattern reduces blast radius.`,
          operations,
          scoreImpact: [
            { metric: 'coupling', before: report.score.breakdown.coupling, after: Math.min(95, report.score.breakdown.coupling + 15) },
          ],
          aiPrompt: `Analyze the file \`${file}\`. Based on its incoming connections, it acts as a coupling bottleneck. Please split this file into the following smaller modules:\n` +
            dependentGroups.map(g => `- \`${moduleName}_${g.name}.${ext}\`: Extract functionality specific to these dependents: ${g.dependents.join(', ')}`).join('\n') +
            `\n\nAfter splitting, securely and automatically update all ${connections.incoming.length} dependent files to import from the new specific modules instead of the monolithic \`${moduleName}.${ext}\`. DO NOT remove any functionality, only move it.`,
        });
      }
    }

    return steps;
  }

  private groupDependents(
    dependents: string[],
  ): Array<{ name: string; dependents: string[] }> {
    // Group by top-level directory
    const groups: Record<string, string[]> = {};

    for (const dep of dependents) {
      const parts = dep.includes('/') ? dep.split('/') : dep.split('.');
      const groupName = parts.length >= 2 ? parts[parts.length - 2]! : 'core';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName]!.push(basename(dep));
    }

    return Object.entries(groups).map(([name, deps]) => ({
      name,
      dependents: deps,
    }));
  }
}
