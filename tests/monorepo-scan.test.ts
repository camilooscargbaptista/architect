/**
 * E2E Tests — Monorepo Scanning
 * 
 * Ensures that the Architect scanner correctly handles monorepo projects
 * with nested node_modules, workspace detection, and framework inference.
 * 
 * This test suite was created to prevent regression of the critical bug where
 * node_modules in sub-packages leaked through the glob ignore filter,
 * contaminating all analysis results (29,181 files instead of 245).
 */

import path from 'path';
import { ProjectScanner } from '../src/infrastructure/scanner.js';
import { ArchitectureAnalyzer } from '../src/core/analyzer.js';
import { AntiPatternDetector } from '../src/core/anti-patterns.js';
import { ConfigLoader, normalizeIgnorePatterns } from '../src/core/config.js';

// Use path.resolve for Jest compatibility (import.meta.url not supported by ts-jest)
const FIXTURE_PATH = path.resolve(process.cwd(), 'tests/fixtures/monorepo');

describe('Monorepo Scanner — node_modules exclusion', () => {
  let config: ReturnType<typeof ConfigLoader.loadConfig>;

  beforeAll(() => {
    config = ConfigLoader.loadConfig(FIXTURE_PATH);
  });

  test('default config uses glob patterns for ignore', () => {
    expect(config.ignore).toBeDefined();
    // Must use glob-style patterns that cover nested directories
    const hasGlobNodeModules = config.ignore!.some(p => p.includes('**/node_modules'));
    expect(hasGlobNodeModules).toBe(true);
  });

  test('scans only project source files, not node_modules', () => {
    const scanner = new ProjectScanner(FIXTURE_PATH, config);
    const result = scanner.scan();

    // Only 2 source .ts files exist: core/src/index.ts and app/src/index.ts
    // Plus 3 package.json files (root + core + app)
    const tsFiles = result.totalFiles;

    // node_modules has 4 files (fake-dep/index.js, fake-dep/package.json, 
    // another-dep/index.js, root-dep/index.js) — NONE should appear
    expect(tsFiles).toBeLessThanOrEqual(10); // generous upper bound
    expect(tsFiles).toBeGreaterThanOrEqual(2); // at least the 2 .ts files

    // Verify no node_modules paths in the file tree
    const allPaths = getAllFilePaths(result.fileTree!);
    const nmPaths = allPaths.filter(p => p.includes('node_modules'));
    expect(nmPaths).toHaveLength(0);
  });

  test('detects workspaces from root package.json', () => {
    const scanner = new ProjectScanner(FIXTURE_PATH, config);
    const result = scanner.scan();

    expect(result.workspaces).toBeDefined();
    expect(result.workspaces!.length).toBe(2);

    const names = result.workspaces!.map(ws => ws.name);
    expect(names).toContain('@test/core');
    expect(names).toContain('@test/app');
  });

  test('detects Express.js from workspace package.json (not from node_modules)', () => {
    const scanner = new ProjectScanner(FIXTURE_PATH, config);
    const result = scanner.scan();

    expect(result.frameworks).toContain('Express.js');
  });

  test('does NOT detect Vue.js or Mongoose from nested node_modules', () => {
    const scanner = new ProjectScanner(FIXTURE_PATH, config);
    const result = scanner.scan();

    // fake-dep/package.json has vue and mongoose as deps
    // These must NOT appear as project frameworks
    expect(result.frameworks).not.toContain('Vue.js');
    expect(result.frameworks).not.toContain('Mongoose');
  });

  test('does NOT detect Spring Boot or Spring (no Java in project)', () => {
    const scanner = new ProjectScanner(FIXTURE_PATH, config);
    const result = scanner.scan();

    expect(result.frameworks).not.toContain('Spring Boot');
    expect(result.frameworks).not.toContain('Spring');
  });

  test('dependency graph contains no node_modules paths', () => {
    const scanner = new ProjectScanner(FIXTURE_PATH, config);
    const result = scanner.scan();

    const analyzer = new ArchitectureAnalyzer(FIXTURE_PATH);
    const edges = analyzer.analyzeDependencies(result.fileTree!);

    for (const edge of edges) {
      expect(edge.from).not.toContain('node_modules');
      expect(edge.to).not.toContain('node_modules');
    }
  });

  test('anti-patterns are only from project files', async () => {
    const scanner = new ProjectScanner(FIXTURE_PATH, config);
    const result = scanner.scan();

    const analyzer = new ArchitectureAnalyzer(FIXTURE_PATH);
    const edges = analyzer.analyzeDependencies(result.fileTree!);
    const deps = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!deps.has(edge.from)) deps.set(edge.from, new Set());
      deps.get(edge.from)!.add(edge.to);
    }

    const detector = new AntiPatternDetector(config);
    const patterns = await detector.detect(result.fileTree!, deps);

    for (const pattern of patterns) {
      expect(pattern.location).not.toContain('node_modules');
      if (pattern.affectedFiles) {
        for (const file of pattern.affectedFiles) {
          expect(file).not.toContain('node_modules');
        }
      }
    }
  });
});

describe('normalizeIgnorePatterns', () => {
  test('converts simple names to glob patterns', () => {
    const result = normalizeIgnorePatterns(['node_modules']);
    expect(result).toContain('**/node_modules/**');
    expect(result).toContain('**/node_modules');
    expect(result).toContain('node_modules/**');
  });

  test('preserves existing glob patterns', () => {
    const result = normalizeIgnorePatterns(['**/dist/**']);
    expect(result).toContain('**/dist/**');
    // Should not double-wrap
    expect(result).not.toContain('**/**/dist/**/**');
  });

  test('handles mixed patterns', () => {
    const result = normalizeIgnorePatterns(['node_modules', '**/custom/**', 'dist']);
    expect(result).toContain('**/node_modules/**');
    expect(result).toContain('**/custom/**');
    expect(result).toContain('**/dist/**');
  });

  test('handles path-like patterns with slashes', () => {
    const result = normalizeIgnorePatterns(['some/specific/path']);
    expect(result).toContain('some/specific/path');
    // Should not expand patterns with slashes
    expect(result).not.toContain('**/some/specific/path/**');
  });
});

// Helper
function getAllFilePaths(node: { path: string; type: string; children?: any[] }): string[] {
  const paths: string[] = [];
  if (node.type === 'file') paths.push(node.path);
  if (node.children) {
    for (const child of node.children) {
      paths.push(...getAllFilePaths(child));
    }
  }
  return paths;
}
