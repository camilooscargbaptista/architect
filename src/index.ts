import { ProjectScanner } from './scanner.js';
import { ArchitectureAnalyzer } from './analyzer.js';
import { AntiPatternDetector } from './anti-patterns.js';
import { ArchitectureScorer } from './scorer.js';
import { DiagramGenerator } from './diagram.js';
import { ReportGenerator } from './reporter.js';
import { HtmlReportGenerator } from './html-reporter.js';
import { RefactorEngine } from './refactor-engine.js';
import { AgentGenerator, AgentSuggestion } from './agent-generator/index.js';
import { ProjectSummarizer } from './project-summarizer.js';
import { ConfigLoader } from './config.js';
import { AnalysisReport, RefactoringPlan } from './types.js';
import { clearAstCache } from './ast-parser.js';
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

export interface AnalyzeOptions {
  onProgress?: ProgressCallback;
  signal?: AbortSignal;
}

export interface ArchitectCommand {
  analyze: (path: string, options?: AnalyzeOptions | ProgressCallback) => Promise<AnalysisReport>;
  refactor: (report: AnalysisReport, projectPath: string) => RefactoringPlan;
  diagram: (path: string) => Promise<string>;
  score: (path: string) => Promise<{ overall: number; breakdown: Record<string, number> }>;
  antiPatterns: (path: string) => Promise<Array<{ name: string; severity: string; description: string }>>;
  layers: (path: string) => Promise<Array<{ name: string; files: string[] }>>;
}

/** Thrown when analyze() is aborted via AbortSignal. */
export class AnalysisAbortedError extends Error {
  constructor() {
    super('Analysis aborted');
    this.name = 'AnalysisAbortedError';
  }
}

class Architect implements ArchitectCommand {
  /**
   * Memoize analyze() results by absolute project path.
   * score()/antiPatterns()/layers() all go through analyze(), so without
   * caching the entire pipeline runs 4x when a caller asks for all four.
   */
  private analyzeCache = new Map<string, Promise<AnalysisReport>>();

  /** Clear cached analyses — useful after file changes or in tests. */
  clearCache(): void {
    this.analyzeCache.clear();
    clearAstCache();
  }

  async analyze(
    projectPath: string,
    optionsOrCallback?: AnalyzeOptions | ProgressCallback,
  ): Promise<AnalysisReport> {
    // Accept the legacy signature `analyze(path, onProgress)` for
    // backward compatibility with existing callers / tests.
    const opts: AnalyzeOptions = typeof optionsOrCallback === 'function'
      ? { onProgress: optionsOrCallback }
      : (optionsOrCallback || {});

    const { signal } = opts;
    const rawEmit = opts.onProgress;
    // Wrap emit in try/catch so a broken progress callback can never kill
    // the analysis.
    const emit: ProgressCallback = (event) => {
      if (!rawEmit) return;
      try {
        rawEmit(event);
      } catch {
        // swallow — progress is advisory
      }
    };
    const checkAborted = (): void => {
      if (signal?.aborted) throw new AnalysisAbortedError();
    };

    // ── Cache hit ──
    // Only cache when no signal is provided (otherwise a cancelled promise
    // would poison the cache).
    if (!signal) {
      const cached = this.analyzeCache.get(projectPath);
      if (cached) return cached;
    }

    const promise = this.runAnalysis(projectPath, emit, checkAborted);
    if (!signal) {
      this.analyzeCache.set(projectPath, promise);
      promise.catch(() => this.analyzeCache.delete(projectPath));
    }
    return promise;
  }

  private async runAnalysis(
    projectPath: string,
    emit: ProgressCallback,
    checkAborted: () => void,
  ): Promise<AnalysisReport> {
    checkAborted();
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
    checkAborted();

    // ── Phase 2: Dependency Analysis ──
    // Run the analyzer exactly once and derive both the edges list and the
    // adjacency map from the same result. The previous implementation
    // called analyzeDependencies twice, duplicating all file parsing.
    emit({ phase: 'dependencies', status: 'start' });
    const analyzer = new ArchitectureAnalyzer(projectPath);
    const edges = analyzer.analyzeDependencies(projectInfo.fileTree);
    const dependencies = new Map<string, Set<string>>();
    for (const edge of edges) {
      let set = dependencies.get(edge.from);
      if (!set) {
        set = new Set<string>();
        dependencies.set(edge.from, set);
      }
      set.add(edge.to);
    }
    emit({
      phase: 'dependencies', status: 'complete',
      metrics: { edges: edges.length, modules: dependencies.size },
    });
    checkAborted();

    // ── Phase 3: Layer Detection ──
    emit({ phase: 'layers', status: 'start' });
    const layers = analyzer.detectLayers(projectInfo.fileTree);
    emit({
      phase: 'layers', status: 'complete',
      metrics: { layers: layers.length, classified: layers.reduce((s, l) => s + l.files.length, 0) },
    });
    checkAborted();

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
    checkAborted();

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
    checkAborted();

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

export {
  ProjectScanner,
  ArchitectureAnalyzer,
  AntiPatternDetector,
  ArchitectureScorer,
  DiagramGenerator,
  ReportGenerator,
  HtmlReportGenerator,
  AgentGenerator,
  ConfigLoader,
};

