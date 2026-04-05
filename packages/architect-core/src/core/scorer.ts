import { ArchitectureScore, DependencyEdge, AntiPattern } from './types/core.js';
import { basename } from 'path';

/**
 * Barrel/index files that naturally have many connections and should be
 * excluded from coupling max-edge penalty calculations.
 * Promoted from class static to module-level for clarity (Fase 2.2).
 */
const BARREL_FILES = new Set([
  '__init__.py', 'index.ts', 'index.js', 'index.tsx', 'index.jsx',
  'mod.rs', '__init__.pyi', 'types.ts', 'types.js', 'logger.ts', 'logger.js',
]);

/**
 * Architecture Scorer — Pure Function Implementation.
 *
 * All methods are stateless: they take input and return output with zero
 * side effects. The class is used for encapsulation only, not for state.
 *
 * Fase 2.2: Confirmed pure — no mutable instance state. All calculation
 * methods are now static to enforce this guarantee at the type level.
 *
 * Scoring weights:
 *   Modularity  40%  — module boundaries and SRP
 *   Coupling    25%  — inter-module dependencies
 *   Cohesion    20%  — related functionality co-location
 *   Layering    15%  — architectural layer adherence
 */
export class ArchitectureScorer {
  /**
   * Compute a complete architecture score from edges, anti-patterns, and file count.
   * Pure function — no side effects, no instance state mutation.
   */
  score(
    edges: DependencyEdge[],
    antiPatterns: AntiPattern[],
    totalFiles: number,
  ): ArchitectureScore {
    const modularity = ArchitectureScorer.calculateModularity(edges, totalFiles);
    const coupling = ArchitectureScorer.calculateCoupling(edges, totalFiles);
    const cohesion = ArchitectureScorer.calculateCohesion(edges);
    const layering = ArchitectureScorer.calculateLayering(antiPatterns, totalFiles);

    const components = [
      {
        name: 'Modularity',
        score: Math.round(modularity),
        maxScore: 100,
        weight: 0.4,
        explanation: 'Measures appropriate module boundaries and single responsibility principle adherence',
      },
      {
        name: 'Coupling',
        score: Math.round(coupling),
        maxScore: 100,
        weight: 0.25,
        explanation: 'Evaluates interdependencies between modules; lower coupling is better',
      },
      {
        name: 'Cohesion',
        score: Math.round(cohesion),
        maxScore: 100,
        weight: 0.2,
        explanation: 'Assesses how closely related functionality is grouped together',
      },
      {
        name: 'Layering',
        score: Math.round(layering),
        maxScore: 100,
        weight: 0.15,
        explanation: 'Checks adherence to architectural layer separation',
      },
    ];

    const overall = Math.round(
      components[0]!.score * components[0]!.weight +
      components[1]!.score * components[1]!.weight +
      components[2]!.score * components[2]!.weight +
      components[3]!.score * components[3]!.weight
    );

    return {
      overall: Math.min(100, Math.max(0, overall)),
      components,
      breakdown: {
        modularity: Math.round(modularity),
        coupling: Math.round(coupling),
        cohesion: Math.round(cohesion),
        layering: Math.round(layering),
      },
    };
  }

  static calculateModularity(edges: DependencyEdge[], totalFiles: number): number {
    if (totalFiles === 0) return 50;

    const avgEdgesPerFile = edges.length / totalFiles;

    if (avgEdgesPerFile < 2) return 100;
    if (avgEdgesPerFile < 4) return 85;
    if (avgEdgesPerFile < 6) return 70;
    if (avgEdgesPerFile < 10) return 50;
    return 30;
  }

  static calculateCoupling(edges: DependencyEdge[], totalFiles: number): number {
    if (totalFiles === 0 || totalFiles === 1) return 50;

    const nonBarrelEdges = edges.filter((e) => {
      const fromFile = basename(e.from);
      const toFile = basename(e.to);
      return !BARREL_FILES.has(fromFile) &&
             !BARREL_FILES.has(toFile);
    });

    const nodeWithMaxEdges = ArchitectureScorer.findNodeWithMaxEdges(nonBarrelEdges);
    const maxEdgeCount = nodeWithMaxEdges ? nodeWithMaxEdges.count : 0;

    const effectiveFiles = Math.max(totalFiles - 1, 1);
    const couplingRatio = maxEdgeCount / effectiveFiles;

    if (couplingRatio < 0.15) return 100;
    if (couplingRatio < 0.25) return 85;
    if (couplingRatio < 0.35) return 75;
    if (couplingRatio < 0.5) return 65;
    if (couplingRatio < 0.7) return 50;
    if (couplingRatio < 0.85) return 35;
    return 20;
  }

  static findNodeWithMaxEdges(edges: DependencyEdge[]): { node: string; count: number } | null {
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

  static calculateCohesion(edges: DependencyEdge[]): number {
    if (edges.length === 0) return 50;

    const internalEdges = edges.filter((e) =>
      ArchitectureScorer.isInternalDependency(e.from, e.to)
    ).length;

    const cohesionRatio = internalEdges / edges.length;

    if (cohesionRatio > 0.8) return 100;
    if (cohesionRatio > 0.6) return 85;
    if (cohesionRatio > 0.45) return 75;
    if (cohesionRatio > 0.3) return 65;
    if (cohesionRatio > 0.15) return 50;
    return 30;
  }

  static isInternalDependency(from: string, to: string): boolean {
    const fromParts = from.split('/');
    const toParts = to.split('/');

    if (fromParts.length <= 1 && toParts.length <= 1) return true;

    const fromTopLevel = fromParts.length > 1 ? fromParts[0] : '';
    const toTopLevel = toParts.length > 1 ? toParts[0] : '';

    return fromTopLevel === toTopLevel;
  }

  static calculateLayering(antiPatterns: AntiPattern[], totalFiles?: number): number {
    const layeringViolations = antiPatterns.filter(
      (p) =>
        p.name === 'Leaky Abstraction' ||
        p.name === 'Shotgun Surgery' ||
        p.name === 'Circular Dependency'
    ).length;

    if (layeringViolations === 0) return 100;

    const fileCount = Math.max(totalFiles || 50, 10);
    const violationRatio = layeringViolations / fileCount;

    if (violationRatio < 0.05) return 95;
    if (violationRatio < 0.15) return 85;
    if (violationRatio < 0.25) return 70;
    if (violationRatio < 0.40) return 50;
    if (violationRatio < 0.60) return 35;
    return 20;
  }
}
