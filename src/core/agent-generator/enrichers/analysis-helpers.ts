import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { AnalysisReport } from '../../types/core.js';
import { ModuleDetail} from '../types/domain.js';
import { EnrichedTemplateContext } from '../types/template.js';

export class AnalysisHelpers {
public findUntestedModules(modules: ModuleDetail[]): string[] {
    return modules
      .filter(m => !m.hasTests && m.fileCount > 1)
      .map(m => m.name);
  }


public findCriticalPaths(report: AnalysisReport): string[] {
    const coupling = new Map<string, number>();
    for (const edge of report.dependencyGraph.edges) {
      coupling.set(edge.from, (coupling.get(edge.from) || 0) + edge.weight);
      coupling.set(edge.to, (coupling.get(edge.to) || 0) + edge.weight);
    }
    return [...coupling.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file]) => file);
  }


public classifyProjectDepth(report: AnalysisReport): EnrichedTemplateContext['projectDepth'] {
    const files = report.projectInfo.totalFiles;
    const lines = report.projectInfo.totalLines;
    if (files > 500 || lines > 100000) return 'enterprise';
    if (files > 200 || lines > 50000) return 'large';
    if (files > 50 || lines > 10000) return 'medium';
    return 'small';
  }


public countFileLines(projectPath: string, filePath: string): number {
    try {
      const fullPath = join(projectPath, filePath);
      if (!existsSync(fullPath)) return 0;

      const stats = statSync(fullPath);
      // Skip files larger than 1MB — estimate based on average line length
      if (stats.size > 1_000_000) {
        return Math.round(stats.size / 45); // ~45 chars avg per line
      }
      if (stats.size === 0) return 0;

      const content = readFileSync(fullPath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }


}
