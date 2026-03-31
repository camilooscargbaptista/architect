import { ProjectScanner, ArchitectureAnalyzer, AntiPatternDetector, ArchitectureScorer, DiagramGenerator, ReportGenerator, HtmlReportGenerator, RefactorEngine, AgentGenerator, AgentSuggestion, ProjectSummarizer, ConfigLoader, normalizeIgnorePatterns, AnalysisReport, RefactoringPlan } from './architect_deps.js';

import { relative } from 'path';

export type ProgressPhase =
  | 'scan' | 'dependencies' | 'layers' | 'antipatterns'
  | 'scoring' | 'summarize' | 'normalize';

export interface ProgressEvent {
  phase: ProgressPhase;
  status: 'start' | 'complete';
  detail?: string;
  metrics?: Record<string, number | string>;
}

export type ProgressCallback = (event: ProgressEvent) => void;

export interface ArchitectCommand {
  analyze: (path: string, onProgress?: ProgressCallback) => Promise<AnalysisReport>;
  refactor: (report: AnalysisReport, projectPath: string) => RefactoringPlan;
  diagram: (path: string) => Promise<string>;
  score: (path: string) => Promise<{ overall: number; breakdown: Record<string, number> }>;
  antiPatterns: (path: string) => Promise<Array<{ name: string; severity: string; description: string }>>;
  layers: (path: string) => Promise<Array<{ name: string; files: string[] }>>;
}

export class Architect implements ArchitectCommand {
  async analyze(projectPath: string, onProgress?: ProgressCallback): Promise<AnalysisReport> {
    const emit = onProgress || (() => {});
    const config = ConfigLoader.loadConfig(projectPath);

    // ── Phase 1: File Scanning ──
    emit({ phase: 'scan', status: 'start' });
    const scanner = new ProjectScanner(projectPath, config);
    const projectInfo = scanner.scan();
    if (!projectInfo.fileTree) {
      throw new Error('Failed to scan project');
    }
    emit({
      phase: 'scan', status: 'complete',
      metrics: { files: projectInfo.totalFiles, lines: projectInfo.totalLines, languages: projectInfo.primaryLanguages.length },
    });

    // ── Phase 2: Dependency Analysis ──
    emit({ phase: 'dependencies', status: 'start' });
    const analyzer = new ArchitectureAnalyzer(projectPath);
    await analyzer.initialize();
    
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
    emit({
      phase: 'dependencies', status: 'complete',
      metrics: { edges: edges.length, modules: dependencies.size },
    });

    // ── Phase 3: Layer Detection ──
    emit({ phase: 'layers', status: 'start' });
    const layers = analyzer.detectLayers(projectInfo.fileTree);
    emit({
      phase: 'layers', status: 'complete',
      metrics: { layers: layers.length, classified: layers.reduce((s, l) => s + l.files.length, 0) },
    });

    // ── Phase 4: Anti-Pattern Detection ──
    emit({ phase: 'antipatterns', status: 'start' });
    const detector = new AntiPatternDetector(config);
    const antiPatterns = detector.detect(projectInfo.fileTree, dependencies);
    emit({
      phase: 'antipatterns', status: 'complete',
      metrics: {
        total: antiPatterns.length,
        critical: antiPatterns.filter(p => p.severity === 'CRITICAL').length,
        high: antiPatterns.filter(p => p.severity === 'HIGH').length,
      },
    });

    // ── Phase 5: Architecture Scoring ──
    emit({ phase: 'scoring', status: 'start' });
    const scorer = new ArchitectureScorer();
    const score = scorer.score(edges, antiPatterns, projectInfo.totalFiles);
    emit({
      phase: 'scoring', status: 'complete',
      metrics: {
        overall: score.overall,
        modularity: score.breakdown.modularity,
        coupling: score.breakdown.coupling,
        cohesion: score.breakdown.cohesion,
        layering: score.breakdown.layering,
      },
    });

    const diagramGenerator = new DiagramGenerator();
    const layerDiagram = diagramGenerator.generateLayerDiagram(layers);
    const suggestions = this.generateSuggestions(antiPatterns, score, edges);

    const report: AnalysisReport = {
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

    // ── Phase 6: Normalize Paths ──
    emit({ phase: 'normalize', status: 'start' });
    const normalized = this.relativizePaths(report, projectPath);
    emit({ phase: 'normalize', status: 'complete' });

    // ── Phase 7: Project Summary ──
    emit({ phase: 'summarize', status: 'start' });
    const summarizer = new ProjectSummarizer();
    normalized.projectSummary = summarizer.summarize(projectPath, normalized);
    emit({
      phase: 'summarize', status: 'complete',
      metrics: {
        modules: normalized.projectSummary?.modules?.length || 0,
        techStack: normalized.projectSummary?.techStack?.length || 0,
      },
    });

    return normalized;
  }

  /**
   * Generate a refactoring plan from an analysis report.
   * Uses Tier 1 (rule engine) and Tier 2 (AST) transforms.
   */
  refactor(report: AnalysisReport, projectPath: string): RefactoringPlan {
    const engine = new RefactorEngine();
    return engine.analyze(report, projectPath);
  }

  /**
   * Generate or audit .agent/ directory for a project.
   */
  agents(
    report: AnalysisReport,
    plan: RefactoringPlan,
    projectPath: string,
    outputDir?: string
  ): { generated: string[]; audit: Array<{ type: string; category: string; file: string; description: string; suggestion?: string }> } {
    const generator = new AgentGenerator();
    return generator.generate(report, plan, projectPath, outputDir);
  }

  /**
   * Suggest agents without writing files — dry-run for unified report.
   */
  suggestAgents(
    report: AnalysisReport,
    plan: RefactoringPlan,
    projectPath: string,
  ): AgentSuggestion {
    const generator = new AgentGenerator();
    return generator.suggest(report, plan, projectPath);
  }

  private relativizePaths(report: AnalysisReport, basePath: string): AnalysisReport {
    const rel = (p: string): string => {
      if (p.startsWith('/') || p.startsWith('\\')) {
        return relative(basePath, p) || p;
      }
      return p;
    };

    report.antiPatterns = report.antiPatterns.map((p) => ({
      ...p,
      location: rel(p.location),
      affectedFiles: p.affectedFiles?.map(rel),
    }));

    report.layers = report.layers.map((l) => ({
      ...l,
      files: l.files.map(rel),
    }));

    report.dependencyGraph.nodes = report.dependencyGraph.nodes.map(rel);
    report.dependencyGraph.edges = report.dependencyGraph.edges.map((e) => ({
      ...e,
      from: rel(e.from),
      to: rel(e.to),
    }));

    return report;
  }

  async diagram(projectPath: string): Promise<string> {
    const config = ConfigLoader.loadConfig(projectPath);
    const scanner = new ProjectScanner(projectPath, config);
    const projectInfo = scanner.scan();

    if (!projectInfo.fileTree) {
      throw new Error('Failed to scan project');
    }

    const analyzer = new ArchitectureAnalyzer(projectPath);
    await analyzer.initialize();
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
    antiPatterns: Array<{ name: string; severity: string; description: string; suggestion: string; location?: string; affectedFiles?: string[] }>,
    score: { overall: number; breakdown: Record<string, number> },
    edges?: { from: string; to: string }[]
  ) {
    const suggestions: Array<{ priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; title: string; description: string; impact: string }> = [];

    // 1. Anti-pattern specific suggestions with file context
    for (const pattern of antiPatterns) {
      const priority = pattern.severity === 'CRITICAL' ? 'CRITICAL' as const : 'HIGH' as const;
      const location = pattern.location ? ` in \`${pattern.location}\`` : '';
      const affected = pattern.affectedFiles?.length
        ? ` Affected files: ${pattern.affectedFiles.slice(0, 3).map(f => `\`${f}\``).join(', ')}${pattern.affectedFiles.length > 3 ? ` (+${pattern.affectedFiles.length - 3} more)` : ''}.`
        : '';

      suggestions.push({
        priority,
        title: pattern.name,
        description: `${pattern.suggestion}${location}.${affected}`,
        impact: `Addressing this ${pattern.name} will improve overall architecture score`,
      });
    }

    // 2. Hub Detection — find files with many connections
    if (edges && edges.length > 0) {
      const connectionCount: Record<string, number> = {};
      for (const edge of edges) {
        connectionCount[edge.from] = (connectionCount[edge.from] || 0) + 1;
        connectionCount[edge.to] = (connectionCount[edge.to] || 0) + 1;
      }

      const hubThreshold = 5;
      const hubs = Object.entries(connectionCount)
        .filter(([_, count]) => count >= hubThreshold)
        .sort((a, b) => b[1] - a[1]);

      for (const [file, count] of hubs.slice(0, 3)) {
        const fileName = file.split('/').pop() || file;
        const isBarrel = ['__init__.py', 'index.ts', 'index.js'].includes(fileName);

        if (!isBarrel) {
          suggestions.push({
            priority: 'HIGH',
            title: `Hub File: ${fileName}`,
            description: `\`${file}\` has ${count} connections. Consider extracting a facade or splitting responsibilities to reduce coupling.`,
            impact: `Reducing connections in \`${fileName}\` can improve coupling score by 10-15 points`,
          });
        }
      }

      // 3. Cross-boundary imports — files importing from many different directories
      const crossBoundary: Record<string, Set<string>> = {};
      for (const edge of edges) {
        const fromDir = edge.from.split('/').slice(0, -1).join('/');
        const toDir = edge.to.split('/').slice(0, -1).join('/');
        if (fromDir !== toDir) {
          if (!crossBoundary[edge.from]) crossBoundary[edge.from] = new Set();
          crossBoundary[edge.from].add(toDir);
        }
      }

      const crossViolators = Object.entries(crossBoundary)
        .filter(([_, dirs]) => dirs.size >= 3)
        .sort((a, b) => b[1].size - a[1].size);

      for (const [file, dirs] of crossViolators.slice(0, 2)) {
        const fileName = file.split('/').pop() || file;
        suggestions.push({
          priority: 'MEDIUM',
          title: `Cross-boundary: ${fileName}`,
          description: `\`${file}\` imports from ${dirs.size} different modules (${Array.from(dirs).slice(0, 3).join(', ')}). Consider dependency injection or a mediator pattern.`,
          impact: `Reducing cross-boundary imports can improve cohesion by 5-10 points`,
        });
      }
    }

    // 4. Score-based suggestions (only if no specific suggestions cover it)
    if (score.breakdown.coupling < 70 && !suggestions.some(s => s.title.startsWith('Hub File'))) {
      suggestions.push({
        priority: 'HIGH',
        title: 'Reduce Coupling',
        description: 'Use dependency injection and invert control to reduce module interdependencies. Consider the Strategy or Observer pattern for loose coupling.',
        impact: 'Can improve coupling score by 15-20 points',
      });
    }

    if (score.breakdown.cohesion < 70 && !suggestions.some(s => s.title.startsWith('Cross-boundary'))) {
      suggestions.push({
        priority: 'MEDIUM',
        title: 'Improve Cohesion',
        description: 'Group related functionality closer together. Files that use each other frequently should be in the same module/package.',
        impact: 'Can improve cohesion score by 10-15 points',
      });
    }

    return suggestions;
  }
}

export const architect = new Architect();
