import { ProjectScanner } from './scanner.js';
import { ArchitectureAnalyzer } from './analyzer.js';
import { AntiPatternDetector } from './anti-patterns.js';
import { ArchitectureScorer } from './scorer.js';
import { DiagramGenerator } from './diagram.js';
import { ReportGenerator } from './reporter.js';
import { ConfigLoader } from './config.js';
import { AnalysisReport } from './types.js';

export interface ArchitectCommand {
  analyze: (path: string) => Promise<AnalysisReport>;
  diagram: (path: string) => Promise<string>;
  score: (path: string) => Promise<{ overall: number; breakdown: Record<string, number> }>;
  antiPatterns: (path: string) => Promise<Array<{ name: string; severity: string; description: string }>>;
  layers: (path: string) => Promise<Array<{ name: string; files: string[] }>>;
}

class Architect implements ArchitectCommand {
  async analyze(projectPath: string): Promise<AnalysisReport> {
    const config = ConfigLoader.loadConfig(projectPath);

    const scanner = new ProjectScanner(projectPath, config);
    const projectInfo = scanner.scan();

    if (!projectInfo.fileTree) {
      throw new Error('Failed to scan project');
    }

    const analyzer = new ArchitectureAnalyzer(projectPath);
    const dependencies = new Map();

    for (const [file, imports] of analyzer
      .analyzeDependencies(projectInfo.fileTree)
      .reduce(
        (map, edge) => {
          if (!map.has(edge.from)) {
            map.set(edge.from, new Set());
          }
          map.get(edge.from)!.add(edge.to);
          return map;
        },
        new Map<string, Set<string>>()
      )
      .entries()) {
      dependencies.set(file, imports);
    }

    const edges = analyzer.analyzeDependencies(projectInfo.fileTree);
    const layers = analyzer.detectLayers(projectInfo.fileTree);

    const detector = new AntiPatternDetector(config);
    const antiPatterns = detector.detect(projectInfo.fileTree, dependencies);

    const scorer = new ArchitectureScorer();
    const score = scorer.score(edges, antiPatterns, projectInfo.totalFiles);

    const diagramGenerator = new DiagramGenerator();
    const layerDiagram = diagramGenerator.generateLayerDiagram(layers);

    const suggestions = this.generateSuggestions(antiPatterns, score);

    return {
      timestamp: new Date().toISOString(),
      projectInfo,
      score,
      antiPatterns,
      layers,
      dependencyGraph: {
        nodes: Array.from(new Set([...edges.map((e) => e.from), ...edges.map((e) => e.to)])),
        edges,
      },
      suggestions,
      diagram: {
        mermaid: layerDiagram,
        type: 'layer',
      },
    };
  }

  async diagram(projectPath: string): Promise<string> {
    const config = ConfigLoader.loadConfig(projectPath);
    const scanner = new ProjectScanner(projectPath, config);
    const projectInfo = scanner.scan();

    if (!projectInfo.fileTree) {
      throw new Error('Failed to scan project');
    }

    const analyzer = new ArchitectureAnalyzer(projectPath);
    const edges = analyzer.analyzeDependencies(projectInfo.fileTree);
    const layers = analyzer.detectLayers(projectInfo.fileTree);

    const generator = new DiagramGenerator();
    return generator.generateComponentDiagram(edges, layers);
  }

  async score(
    projectPath: string
  ): Promise<{ overall: number; breakdown: Record<string, number> }> {
    const report = await this.analyze(projectPath);
    return {
      overall: report.score.overall,
      breakdown: report.score.breakdown,
    };
  }

  async antiPatterns(
    projectPath: string
  ): Promise<Array<{ name: string; severity: string; description: string }>> {
    const report = await this.analyze(projectPath);
    return report.antiPatterns.map((p) => ({
      name: p.name,
      severity: p.severity,
      description: p.description,
    }));
  }

  async layers(
    projectPath: string
  ): Promise<Array<{ name: string; files: string[] }>> {
    const report = await this.analyze(projectPath);
    return report.layers.map((l) => ({
      name: l.name,
      files: l.files,
    }));
  }

  private generateSuggestions(
    antiPatterns: Array<{ name: string; severity: string; description: string; suggestion: string }>,
    score: { overall: number; breakdown: Record<string, number> }
  ) {
    const suggestions: Array<{ priority: string; title: string; description: string; impact: string }> = [];

    for (const pattern of antiPatterns) {
      const priority = pattern.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
      suggestions.push({
        priority,
        title: pattern.name,
        description: pattern.suggestion,
        impact: `Addressing this ${pattern.name} will improve overall architecture score`,
      });
    }

    if (score.breakdown.coupling < 70) {
      suggestions.push({
        priority: 'HIGH',
        title: 'Reduce Coupling',
        description: 'Use dependency injection and invert control to reduce module interdependencies',
        impact: 'Can improve coupling score by 15-20 points',
      });
    }

    if (score.breakdown.cohesion < 70) {
      suggestions.push({
        priority: 'MEDIUM',
        title: 'Improve Cohesion',
        description: 'Group related functionality closer together; consider extracting utility modules',
        impact: 'Can improve cohesion score by 10-15 points',
      });
    }

    return suggestions;
  }
}

export const architect = new Architect();

export {
  ProjectScanner,
  ArchitectureAnalyzer,
  AntiPatternDetector,
  ArchitectureScorer,
  DiagramGenerator,
  ReportGenerator,
  ConfigLoader,
};
