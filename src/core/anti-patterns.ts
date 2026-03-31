import { readFileSync } from 'fs';
import { AntiPattern, ArchitectConfig } from './types/core.js';
import { FileNode } from './types/infrastructure.js';
import type { CustomAntiPatternDetector, PluginContext } from './types/plugin.js';
import { logger } from '../infrastructure/logger.js';

export class AntiPatternDetector {
  private config: ArchitectConfig;
  private dependencyGraph: Map<string, Set<string>>;

  /** Paths that indicate third-party or build artifacts — never report anti-patterns here */
  private static readonly EXCLUDED_PATH_SEGMENTS = [
    'node_modules', '/dist/', '/build/', '/coverage/',
    '/.next/', '/venv/', '/__pycache__/', '/target/',
  ];

  private customDetectors: CustomAntiPatternDetector[] = [];
  private pluginContext?: PluginContext;

  constructor(config: ArchitectConfig) {
    this.config = config;
    this.dependencyGraph = new Map();
  }

  public setCustomDetectors(detectors: CustomAntiPatternDetector[]) {
    this.customDetectors = detectors;
  }

  /**
   * Check if a file path belongs to the project's own source code.
   * Returns false for node_modules, dist, build artifacts, etc.
   */
  private isProjectFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return !AntiPatternDetector.EXCLUDED_PATH_SEGMENTS.some(seg =>
      normalized.includes(seg)
    );
  }

  async detect(
    fileTree: FileNode,
    dependencies: Map<string, Set<string>>
  ): Promise<AntiPattern[]> {
    this.dependencyGraph = dependencies;
    const patterns: AntiPattern[] = [];

    patterns.push(...this.detectGodClasses(fileTree));
    patterns.push(...this.detectCircularDependencies());
    patterns.push(...this.detectLeakyAbstractions(fileTree));
    patterns.push(...this.detectFeatureEnvy(fileTree, dependencies));
    patterns.push(...this.detectShotgunSurgery(dependencies));

    // Execute Enterprise Custom Plugin Detectors
    const context: PluginContext = this.pluginContext || {
      config: this.config,
      projectPath: process.cwd() // Fallback if not injected explicitly
    };

    for (const detector of this.customDetectors) {
      try {
        const customPatterns = await detector(fileTree, dependencies, context);
        if (Array.isArray(customPatterns)) {
          patterns.push(...customPatterns);
        }
      } catch (err) {
        logger.warn(`[Architect Plugin] A custom rule engine failed during detection: ${(err as Error).message}`);
      }
    }

    return patterns.sort((a, b) => {
      const severityOrder: Record<string, number> = {
        CRITICAL: 0,
        HIGH: 1,
        MEDIUM: 2,
        LOW: 3,
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private detectGodClasses(node: FileNode): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const threshold =
      this.config.antiPatterns?.godClass?.linesThreshold || 800; // Increased to 800 for OSS realities
    const methodThreshold =
      this.config.antiPatterns?.godClass?.methodsThreshold || 20; // Increased to 20

    this.walkFileTree(node, (file) => {
      if (file.type === 'file' && (file.lines || 0) > threshold && this.isProjectFile(file.path)) {
        const methods = this.countMethods(file.path);
        if (methods > methodThreshold) {
          patterns.push({
            name: 'God Class',
            severity: 'CRITICAL',
            location: file.path,
            description: `Class with ${file.lines} lines and ${methods} methods violates single responsibility principle`,
            suggestion:
              'Consider splitting into smaller, focused classes with specific responsibilities',
            metrics: {
              lines: file.lines || 0,
              methods,
            },
          });
        }
      }
    });

    return patterns;
  }

  private detectCircularDependencies(): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const file of this.dependencyGraph.keys()) {
      // Only check cycles starting from project files
      if (!this.isProjectFile(file)) continue;

      if (!visited.has(file)) {
        const cycle = this.findCycle(file, visited, recursionStack);
        if (cycle && cycle.every(f => this.isProjectFile(f))) {
          patterns.push({
            name: 'Circular Dependency',
            severity: 'HIGH',
            location: cycle.join(' -> '),
            description: `Circular dependency detected: ${cycle.join(' -> ')}`,
            suggestion:
              'Refactor code to break the circular dependency using dependency injection or intermediate abstractions',
            affectedFiles: cycle,
          });
        }
      }
    }

    return patterns;
  }

  private findCycle(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>
  ): string[] | null {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = this.dependencyGraph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const cycle = this.findCycle(neighbor, visited, recursionStack);
        if (cycle) {
          cycle.unshift(node);
          return cycle;
        }
      } else if (recursionStack.has(neighbor)) {
        return [node, neighbor];
      }
    }

    recursionStack.delete(node);
    return null;
  }

  private detectLeakyAbstractions(node: FileNode): AntiPattern[] {
    const patterns: AntiPattern[] = [];

    this.walkFileTree(node, (file) => {
      if (file.type === 'file' && this.isProjectFile(file.path)) {
        const internalExports = this.countInternalExports(file.path);
        if (internalExports > 5) {
          patterns.push({
            name: 'Leaky Abstraction',
            severity: 'MEDIUM',
            location: file.path,
            description: `Exports ${internalExports} internal types that should be private`,
            suggestion:
              'Use private/internal access modifiers and facade patterns to hide implementation details',
            metrics: {
              exportedInternalTypes: internalExports,
            },
          });
        }
      }
    });

    return patterns;
  }

  private detectFeatureEnvy(
    node: FileNode,
    dependencies: Map<string, Set<string>>
  ): AntiPattern[] {
    const patterns: AntiPattern[] = [];

    this.walkFileTree(node, (file) => {
      if (file.type === 'file' && this.isProjectFile(file.path)) {
        const externalMethodCalls = (dependencies.get(file.path) || new Set())
          .size;
        const internalMethods = this.countMethods(file.path);
        const name = file.name.toLowerCase();

        // Skip infrastructure files where external deps are by design
        const isInfraFile =
          name.endsWith('.module.ts') ||
          name.endsWith('.dto.ts') ||
          name.endsWith('.entity.ts') ||
          name.endsWith('.guard.ts') ||
          name.endsWith('.pipe.ts') ||
          name.endsWith('.interceptor.ts') ||
          name.endsWith('.filter.ts') ||
          name.endsWith('.decorator.ts') ||
          name.endsWith('.spec.ts') ||
          name.endsWith('.test.ts') ||
          name.endsWith('-engine.ts') ||
          name.endsWith('-enricher.ts') ||
          name.endsWith('-detector.ts') ||
          file.path.includes('/scripts/');

        if (!isInfraFile && internalMethods > 0 && externalMethodCalls > internalMethods * 3) {
          patterns.push({
            name: 'Feature Envy',
            severity: 'MEDIUM',
            location: file.path,
            description: `Uses more external methods (${externalMethodCalls}) than internal methods (${internalMethods})`,
            suggestion:
              'Move functionality closer to where it is used or extract to shared utility',
            metrics: {
              externalMethodCalls,
              internalMethods,
            },
          });
        }
      }
    });

    return patterns;
  }

  private detectShotgunSurgery(
    dependencies: Map<string, Set<string>>
  ): AntiPattern[] {
    const patterns: AntiPattern[] = [];
    const threshold =
      this.config.antiPatterns?.shotgunSurgery?.changePropagationThreshold ||
      Math.max(15, Math.ceil(this.dependencyGraph.size * 0.02));

    for (const [file, dependents] of dependencies) {
      // Only report for project files
      if (!this.isProjectFile(file)) continue;

      const fileName = file.split('/').pop() || '';
      const isBaseFile = ['index.ts', 'index.js', 'types.ts', 'logger.ts', 'config.ts', 'architect.ts', 'constants.ts', 'interfaces.ts', 'globals.ts'].includes(fileName) ||
                         fileName.endsWith('.interface.ts') || fileName.endsWith('.constants.ts') || fileName.endsWith('.type.ts') || fileName.endsWith('.model.ts') || fileName.endsWith('.enum.ts');
      const isExcludedDir = file.includes('tests/') || file.includes('scripts/') || file.includes('adapters/') || file.includes('agent-generator/');
      if (isBaseFile || isExcludedDir) continue;

      if (dependents.size >= threshold) {
        patterns.push({
          name: 'Shotgun Surgery',
          severity: 'HIGH',
          location: file,
          description: `Changes to this file likely require modifications in ${dependents.size} other files`,
          suggestion:
            'Refactor to reduce coupling and consolidate related functionality into modules',
          affectedFiles: Array.from(dependents).filter(f => this.isProjectFile(f)),
          metrics: {
            dependentFileCount: dependents.size,
          },
        });
      }
    }

    return patterns;
  }

  private countMethods(filePath: string): number {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const methodRegex = /(?:async\s+)?(?:function|public|private|protected|static)\s+\w+\s*\(/g;
      const arrowMethodRegex = /(?:readonly\s+)?\w+\s*=\s*(?:async\s+)?\(/g;
      const matches = content.match(methodRegex);
      const arrowMatches = content.match(arrowMethodRegex);
      return (matches ? matches.length : 0) + (arrowMatches ? arrowMatches.length : 0);
    } catch {
      return 0;
    }
  }

  private countInternalExports(filePath: string): number {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const internalTypes = [
        '_',
        'Internal',
        'Private',
        'Impl',
        'Detail',
      ];
      let count = 0;

      for (const type of internalTypes) {
        const regex = new RegExp(`export\\s+\\w*${type}\\w*`, 'g');
        const matches = content.match(regex);
        count += matches ? matches.length : 0;
      }

      return count;
    } catch {
      return 0;
    }
  }

  private walkFileTree(
    node: FileNode,
    callback: (node: FileNode) => void
  ): void {
    callback(node);
    if (node.children) {
      for (const child of node.children) {
        this.walkFileTree(child, callback);
      }
    }
  }
}
