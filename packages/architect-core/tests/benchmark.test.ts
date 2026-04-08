/**
 * Performance Benchmark — Architecture Analysis Engine
 *
 * Tests that the analysis pipeline completes within acceptable
 * time limits for projects of various sizes.
 *
 * Target: 100K+ lines repo analyzed in < 30 seconds
 *
 * @since v9.0.0 — Phase 1C (Hardening)
 */

import { ArchitectureScorer } from '../src/core/scorer.js';
import { RefactorEngine } from '../src/core/refactor-engine.js';
import { KnowledgeBase } from '../src/core/knowledge-base/knowledge-base.js';
import type { DependencyEdge, AntiPattern, AnalysisReport } from '../src/core/types/core.js';
import type { FileNode } from '../src/core/types/infrastructure.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ── Helpers ──────────────────────────────────────────────

/**
 * Generate a synthetic file tree with N files across M directories.
 */
function generateFileTree(totalFiles: number, dirsPerLevel: number = 5): FileNode {
  const root: FileNode = { path: 'src', name: 'src', type: 'directory', children: [] };
  const extensions = ['.ts', '.js', '.py', '.go', '.java'];
  const dirNames = ['controllers', 'services', 'models', 'utils', 'components', 'views', 'routes', 'middleware', 'config', 'lib'];
  const importTargets: string[] = [];

  let fileCount = 0;

  for (let d = 0; d < Math.min(dirsPerLevel, dirNames.length); d++) {
    const dirName = dirNames[d]!;
    const dir: FileNode = { path: `src/${dirName}`, name: dirName, type: 'directory', children: [] };

    const filesInDir = Math.ceil(totalFiles / dirsPerLevel);
    for (let f = 0; f < filesInDir && fileCount < totalFiles; f++) {
      const ext = extensions[f % extensions.length]!;
      const fileName = `file${fileCount}${ext}`;
      const filePath = `src/${dirName}/${fileName}`;

      importTargets.push(filePath);

      const file: FileNode = {
        path: filePath,
        name: fileName,
        type: 'file',
        extension: ext,
        lines: 50 + Math.floor(Math.random() * 200),
        language: ext === '.ts' ? 'typescript' : ext === '.py' ? 'python' : 'javascript',
        imports: [],
        exports: [`export${fileCount}`],
      };

      dir.children!.push(file);
      fileCount++;
    }

    root.children!.push(dir);
  }

  // Add cross-directory imports (creates realistic coupling)
  for (const dir of root.children!) {
    for (const file of dir.children ?? []) {
      const numImports = Math.min(3, importTargets.length);
      const imports: string[] = [];
      for (let i = 0; i < numImports; i++) {
        const target = importTargets[Math.floor(Math.random() * importTargets.length)]!;
        if (target !== file.path) imports.push(target);
      }
      (file as any).imports = imports;
    }
  }

  return root;
}

/**
 * Generate synthetic edges from a file tree.
 */
function generateEdges(fileTree: FileNode): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const allFiles: FileNode[] = [];

  function collect(node: FileNode) {
    if (node.type === 'file') allFiles.push(node);
    for (const child of node.children ?? []) collect(child);
  }
  collect(fileTree);

  for (const file of allFiles) {
    for (const imp of file.imports ?? []) {
      edges.push({
        from: file.path,
        to: imp,
        type: 'import',
        weight: 1,
      });
    }
  }

  return edges;
}

/**
 * Generate synthetic anti-patterns based on project size.
 */
function generateAntiPatterns(fileCount: number): AntiPattern[] {
  const patterns: AntiPattern[] = [];
  const types = ['God Class', 'Circular Dependency', 'Leaky Abstraction', 'Shotgun Surgery', 'Spaghetti Module'];

  // ~1 anti-pattern per 50 files
  const count = Math.max(1, Math.floor(fileCount / 50));
  for (let i = 0; i < count; i++) {
    patterns.push({
      name: types[i % types.length]!,
      severity: i % 3 === 0 ? 'CRITICAL' : i % 3 === 1 ? 'HIGH' : 'MEDIUM',
      location: `src/file${i}.ts`,
      description: `Synthetic anti-pattern ${i}`,
      suggestion: `Fix ${types[i % types.length]!}`,
    });
  }

  return patterns;
}

function buildMockReport(fileCount: number): AnalysisReport {
  const fileTree = generateFileTree(fileCount);
  const edges = generateEdges(fileTree);
  const antiPatterns = generateAntiPatterns(fileCount);
  const scorer = new ArchitectureScorer();
  const score = scorer.score(edges, antiPatterns, fileCount);

  let totalLines = 0;
  function countLines(node: FileNode) {
    if (node.type === 'file') totalLines += node.lines ?? 100;
    for (const child of node.children ?? []) countLines(child);
  }
  countLines(fileTree);

  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      path: '/synthetic/project',
      name: 'benchmark-project',
      frameworks: ['Express.js'],
      primaryLanguages: ['typescript'],
      totalFiles: fileCount,
      totalLines: totalLines,
      fileTree,
    },
    score,
    antiPatterns,
    layers: [
      { name: 'API', files: ['src/controllers/file0.ts'], description: 'API' },
      { name: 'Service', files: ['src/services/file1.ts'], description: 'Service' },
    ],
    dependencyGraph: {
      nodes: Array.from(new Set([...edges.map(e => e.from), ...edges.map(e => e.to)])),
      edges,
    },
    suggestions: [],
    diagram: { mermaid: 'graph TD; A-->B;', type: 'dependency' },
  };
}

// ── Benchmarks ───────────────────────────────────────────

describe('Performance Benchmarks', () => {

  describe('Scorer performance', () => {
    it('should score 1K files in < 50ms', () => {
      const fileTree = generateFileTree(1000);
      const edges = generateEdges(fileTree);
      const antiPatterns = generateAntiPatterns(1000);
      const scorer = new ArchitectureScorer();

      const start = performance.now();
      scorer.score(edges, antiPatterns, 1000);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should score 10K files in < 200ms', () => {
      const fileTree = generateFileTree(10000, 10);
      const edges = generateEdges(fileTree);
      const antiPatterns = generateAntiPatterns(10000);
      const scorer = new ArchitectureScorer();

      const start = performance.now();
      scorer.score(edges, antiPatterns, 10000);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('Refactor engine performance', () => {
    it('should generate refactor plan for 1K files in < 500ms', () => {
      const report = buildMockReport(1000);
      const engine = new RefactorEngine();

      const start = performance.now();
      engine.analyze(report, '/synthetic/project');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
    });

    it('should generate refactor plan for 5K files in < 2000ms', () => {
      const report = buildMockReport(5000);
      const engine = new RefactorEngine();

      const start = performance.now();
      engine.analyze(report, '/synthetic/project');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(2000);
    });
  });

  describe('Knowledge Base performance', () => {
    let tmpDir: string;
    let kb: KnowledgeBase;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), 'architect-bench-'));
      kb = new KnowledgeBase(tmpDir);
    });

    afterEach(() => {
      kb.close();
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should persist 1K-file report in < 200ms', () => {
      const report = buildMockReport(1000);

      const start = performance.now();
      kb.persistAnalysis(report);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(200);
    });

    it('should persist 100 sequential analyses in < 3000ms', () => {
      const reports = Array.from({ length: 100 }, (_, i) => {
        const r = buildMockReport(100);
        r.timestamp = new Date(Date.now() + i * 86400000).toISOString();
        return r;
      });

      const start = performance.now();
      for (const r of reports) {
        kb.persistAnalysis(r);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(3000);
    });

    it('should query score history of 100 analyses in < 10ms', () => {
      // Seed 100 analyses
      for (let i = 0; i < 100; i++) {
        const r = buildMockReport(50);
        r.timestamp = new Date(Date.now() + i * 86400000).toISOString();
        kb.persistAnalysis(r);
      }

      const project = kb.getProjectByPath('/synthetic/project')!;

      const start = performance.now();
      const history = kb.getScoreHistory(project.id, 100);
      const elapsed = performance.now() - start;

      expect(history).toHaveLength(100);
      expect(elapsed).toBeLessThan(10);
    });

    it('should generate LLM context for 100 analyses in < 20ms', () => {
      for (let i = 0; i < 100; i++) {
        const r = buildMockReport(50);
        r.timestamp = new Date(Date.now() + i * 86400000).toISOString();
        kb.persistAnalysis(r);
      }

      const project = kb.getProjectByPath('/synthetic/project')!;

      const start = performance.now();
      const context = kb.generateLLMContext(project.id);
      const elapsed = performance.now() - start;

      expect(context.length).toBeGreaterThan(100);
      expect(elapsed).toBeLessThan(20);
    });
  });

  describe('End-to-end pipeline simulation', () => {
    it('should complete full analysis pipeline for 2K files in < 1s (excl. AST)', () => {
      const fileTree = generateFileTree(2000, 8);
      const edges = generateEdges(fileTree);
      const antiPatterns = generateAntiPatterns(2000);

      const start = performance.now();

      // Score
      const scorer = new ArchitectureScorer();
      const score = scorer.score(edges, antiPatterns, 2000);

      // Build report
      const report: AnalysisReport = {
        timestamp: new Date().toISOString(),
        projectInfo: {
          path: '/bench', name: 'bench', frameworks: [], primaryLanguages: ['typescript'],
          totalFiles: 2000, totalLines: 200000, fileTree,
        },
        score, antiPatterns,
        layers: [],
        dependencyGraph: { nodes: Array.from(new Set([...edges.map(e => e.from), ...edges.map(e => e.to)])), edges },
        suggestions: [],
        diagram: { mermaid: '', type: 'dependency' },
      };

      // Refactor plan
      const engine = new RefactorEngine();
      engine.analyze(report, '/bench');

      // KB persist
      const tmpDir = mkdtempSync(join(tmpdir(), 'bench-'));
      const kb = new KnowledgeBase(tmpDir);
      kb.persistAnalysis(report);
      kb.close();
      rmSync(tmpDir, { recursive: true, force: true });

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(1000);
    });
  });
});
