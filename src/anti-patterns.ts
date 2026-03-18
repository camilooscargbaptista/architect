import { readFileSync } from 'fs';
import { AntiPattern, FileNode, ArchitectConfig } from './types.js';

export class AntiPatternDetector {
  private config: ArchitectConfig;
  private dependencyGraph: Map<string, Set<string>>;

  constructor(config: ArchitectConfig) {
    this.config = config;
    this.dependencyGraph = new Map();
  }

  detect(
    fileTree: FileNode,
    dependencies: Map<string, Set<string>>
  ): AntiPattern[] {
    this.dependencyGraph = dependencies;
    const patterns: AntiPattern[] = [];

    patterns.push(...this.detectGodClasses(fileTree));
    patterns.push(...this.detectCircularDependencies());
    patterns.push(...this.detectLeakyAbstractions(fileTree));
    patterns.push(...this.detectFeatureEnvy(fileTree, dependencies));
    patterns.push(...this.detectShotgunSurgery(dependencies));

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
      this.config.antiPatterns?.godClass?.linesThreshold || 500;
    const methodThreshold =
      this.config.antiPatterns?.godClass?.methodsThreshold || 10;

    this.walkFileTree(node, (file) => {
      if (file.type === 'file' && (file.lines || 0) > threshold) {
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
      if (!visited.has(file)) {
        const cycle = this.findCycle(file, visited, recursionStack);
        if (cycle) {
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
      if (file.type === 'file') {
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
      if (file.type === 'file') {
        const externalMethodCalls = (dependencies.get(file.path) || new Set())
          .size;
        const internalMethods = this.countMethods(file.path);

        if (internalMethods > 0 && externalMethodCalls > internalMethods * 2) {
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
      this.config.antiPatterns?.shotgunSurgery
        ?.changePropagationThreshold || 5;

    for (const [file, dependents] of dependencies) {
      if (dependents.size >= threshold) {
        patterns.push({
          name: 'Shotgun Surgery',
          severity: 'HIGH',
          location: file,
          description: `Changes to this file likely require modifications in ${dependents.size} other files`,
          suggestion:
            'Refactor to reduce coupling and consolidate related functionality into modules',
          affectedFiles: Array.from(dependents),
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
      const methodRegex = /(?:function|public|private|protected)\s+\w+\s*\(/g;
      const matches = content.match(methodRegex);
      return matches ? matches.length : 0;
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
