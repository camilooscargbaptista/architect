import { ArchitectureScore, DependencyEdge, AntiPattern, ScoreComponent } from './types.js';
import { basename } from 'path';

export class ArchitectureScorer {
  private modularity: number = 0;
  private coupling: number = 0;
  private cohesion: number = 0;
  private layering: number = 0;

  /**
   * Barrel/index files that naturally have many connections and should be
   * excluded from coupling max-edge penalty calculations.
   */
  private static readonly BARREL_FILES = new Set([
    '__init__.py', 'index.ts', 'index.js', 'index.tsx', 'index.jsx',
    'mod.rs', '__init__.pyi',
  ]);

  score(
    edges: DependencyEdge[],
    antiPatterns: AntiPattern[],
    totalFiles: number
  ): ArchitectureScore {
    this.calculateModularity(edges, totalFiles);
    this.calculateCoupling(edges, totalFiles);
    this.calculateCohesion(edges);
    this.calculateLayering(antiPatterns, totalFiles);

    const components = [
      {
        name: 'Modularity',
        score: Math.round(this.modularity),
        maxScore: 100,
        weight: 0.4,
        explanation:
          'Measures appropriate module boundaries and single responsibility principle adherence',
      },
      {
        name: 'Coupling',
        score: Math.round(this.coupling),
        maxScore: 100,
        weight: 0.25,
        explanation:
          'Evaluates interdependencies between modules; lower coupling is better',
      },
      {
        name: 'Cohesion',
        score: Math.round(this.cohesion),
        maxScore: 100,
        weight: 0.2,
        explanation:
          'Assesses how closely related functionality is grouped together',
      },
      {
        name: 'Layering',
        score: Math.round(this.layering),
        maxScore: 100,
        weight: 0.15,
        explanation: 'Checks adherence to architectural layer separation',
      },
    ];

    const overall = Math.round(
      components[0].score * components[0].weight +
        components[1].score * components[1].weight +
        components[2].score * components[2].weight +
        components[3].score * components[3].weight
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      components,
      breakdown: {
        modularity: Math.round(this.modularity),
        coupling: Math.round(this.coupling),
        cohesion: Math.round(this.cohesion),
        layering: Math.round(this.layering),
      },
    };
  }

  private calculateModularity(edges: DependencyEdge[], totalFiles: number): void {
    if (totalFiles === 0) {
      this.modularity = 50;
      return;
    }

    const avgEdgesPerFile = edges.length / totalFiles;

    if (avgEdgesPerFile < 2) {
      this.modularity = 95;
    } else if (avgEdgesPerFile < 4) {
      this.modularity = 85;
    } else if (avgEdgesPerFile < 6) {
      this.modularity = 70;
    } else if (avgEdgesPerFile < 10) {
      this.modularity = 50;
    } else {
      this.modularity = 30;
    }
  }

  private calculateCoupling(edges: DependencyEdge[], totalFiles: number): void {
    if (totalFiles === 0 || totalFiles === 1) {
      this.coupling = 50;
      return;
    }

    // Exclude barrel/index files from max-edge calculation —
    // they naturally have many connections by design.
    const nonBarrelEdges = edges.filter((e) => {
      const fromFile = basename(e.from);
      const toFile = basename(e.to);
      return !ArchitectureScorer.BARREL_FILES.has(fromFile) &&
             !ArchitectureScorer.BARREL_FILES.has(toFile);
    });

    const nodeWithMaxEdges = this.findNodeWithMaxEdges(nonBarrelEdges);
    const maxEdgeCount = nodeWithMaxEdges ? nodeWithMaxEdges.count : 0;

    // Use non-barrel file count for ratio calculation
    const effectiveFiles = Math.max(totalFiles - 1, 1);
    const couplingRatio = maxEdgeCount / effectiveFiles;

    // More granular thresholds
    if (couplingRatio < 0.15) {
      this.coupling = 95;
    } else if (couplingRatio < 0.25) {
      this.coupling = 85;
    } else if (couplingRatio < 0.35) {
      this.coupling = 75;
    } else if (couplingRatio < 0.5) {
      this.coupling = 65;
    } else if (couplingRatio < 0.7) {
      this.coupling = 50;
    } else if (couplingRatio < 0.85) {
      this.coupling = 35;
    } else {
      this.coupling = 20;
    }
  }

  private findNodeWithMaxEdges(
    edges: DependencyEdge[]
  ): { node: string; count: number } | null {
    const nodeEdgeCount: Record<string, number> = {};

    for (const edge of edges) {
      nodeEdgeCount[edge.from] = (nodeEdgeCount[edge.from] || 0) + 1;
      nodeEdgeCount[edge.to] = (nodeEdgeCount[edge.to] || 0) + 1;
    }

    let maxNode: string | null = null;
    let maxCount = 0;

    for (const [node, count] of Object.entries(nodeEdgeCount)) {
      if (count > maxCount) {
        maxCount = count;
        maxNode = node;
      }
    }

    return maxNode ? { node: maxNode, count: maxCount } : null;
  }

  private calculateCohesion(edges: DependencyEdge[]): void {
    if (edges.length === 0) {
      this.cohesion = 50;
      return;
    }

    const internalEdges = edges.filter((e) =>
      this.isInternalDependency(e.from, e.to)
    ).length;

    const cohesionRatio = internalEdges / edges.length;

    // More granular thresholds
    if (cohesionRatio > 0.8) {
      this.cohesion = 95;
    } else if (cohesionRatio > 0.6) {
      this.cohesion = 85;
    } else if (cohesionRatio > 0.45) {
      this.cohesion = 75;
    } else if (cohesionRatio > 0.3) {
      this.cohesion = 65;
    } else if (cohesionRatio > 0.15) {
      this.cohesion = 50;
    } else {
      this.cohesion = 30;
    }
  }

  /**
   * Determines if a dependency is "internal" (cohesive).
   * Two files are considered cohesive if they share the same top-level
   * package/directory (e.g., deepguard/cli.py → deepguard/analyzer.py).
   * This is crucial for Python flat packages where all files live in
   * one directory but ARE cohesive.
   */
  private isInternalDependency(from: string, to: string): boolean {
    const fromParts = from.split('/');
    const toParts = to.split('/');

    // If both are in root (no directory), they're cohesive
    if (fromParts.length <= 1 && toParts.length <= 1) return true;

    // Compare top-level directory (package name)
    // e.g., "deepguard/cli.py" and "deepguard/analyzer.py" → same package
    const fromTopLevel = fromParts.length > 1 ? fromParts[0] : '';
    const toTopLevel = toParts.length > 1 ? toParts[0] : '';

    return fromTopLevel === toTopLevel;
  }

  private calculateLayering(antiPatterns: AntiPattern[], totalFiles?: number): void {
    const layeringViolations = antiPatterns.filter(
      (p) =>
        p.name === 'Leaky Abstraction' ||
        p.name === 'Shotgun Surgery' ||
        p.name === 'Circular Dependency'
    ).length;

    if (layeringViolations === 0) {
      this.layering = 95;
      return;
    }

    // Use ratio-based scoring: violations per 100 files
    // This makes scoring fair regardless of project size
    const fileCount = Math.max(totalFiles || 50, 10);
    const violationRatio = layeringViolations / fileCount;

    if (violationRatio < 0.02) {
      // < 2% — e.g. 1 violation in 50 files
      this.layering = 90;
    } else if (violationRatio < 0.05) {
      // < 5% — e.g. 2-3 violations in 50 files
      this.layering = 80;
    } else if (violationRatio < 0.1) {
      // < 10% — e.g. 5 violations in 50 files
      this.layering = 65;
    } else if (violationRatio < 0.2) {
      // < 20% — significant issues
      this.layering = 50;
    } else if (violationRatio < 0.35) {
      this.layering = 35;
    } else {
      // > 35% — severe layering problems
      this.layering = 20;
    }
  }
}

