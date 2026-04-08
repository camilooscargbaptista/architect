import { ArchitectureScore, DependencyEdge, AntiPattern } from './types/core.js';
import { basename } from 'path';
import type { ScoringWeights, ScoringThresholds } from './scoring-profiles.js';

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
 * Default weights — backward compatible with pre-v9.0 behavior.
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
  modularity: 0.4,
  coupling: 0.25,
  cohesion: 0.2,
  layering: 0.15,
};

/**
 * Default thresholds — backward compatible with pre-v9.0 behavior.
 */
const DEFAULT_THRESHOLDS: ScoringThresholds = {
  modularityExcellent: 2,
  modularityGood: 6,
  couplingExcellent: 0.15,
  couplingGood: 0.35,
  cohesionExcellent: 0.8,
  cohesionGood: 0.45,
  godClassLines: 500,
  godClassMethods: 10,
};

/**
 * Architecture Scorer — Pure Function Implementation.
 *
 * All methods are stateless: they take input and return output with zero
 * side effects. The class is used for encapsulation only, not for state.
 *
 * Fase 2.2: Confirmed pure — no mutable instance state.
 * v9.0 (Phase 1B): Accepts adaptive weights and thresholds per profile.
 *
 * Default scoring weights:
 *   Modularity  40%  — module boundaries and SRP
 *   Coupling    25%  — inter-module dependencies
 *   Cohesion    20%  — related functionality co-location
 *   Layering    15%  — architectural layer adherence
 */
export class ArchitectureScorer {
  private weights: ScoringWeights;
  private thresholds: ScoringThresholds;
  private profileName: string;

  /**
   * @param weights - Adaptive scoring weights (default: balanced 40/25/20/15)
   * @param thresholds - Adaptive thresholds per metric (default: standard)
   * @param profileName - Name of the active profile (for reporting)
   */
  constructor(
    weights?: ScoringWeights,
    thresholds?: ScoringThresholds,
    profileName?: string,
  ) {
    this.weights = weights ?? DEFAULT_WEIGHTS;
    this.thresholds = thresholds ?? DEFAULT_THRESHOLDS;
    this.profileName = profileName ?? 'default';
  }

  /**
   * Compute a complete architecture score from edges, anti-patterns, and file count.
   * Pure function — no side effects, no instance state mutation.
   */
  score(
    edges: DependencyEdge[],
    antiPatterns: AntiPattern[],
    totalFiles: number,
  ): ArchitectureScore {
    const modularity = this.calculateModularity(edges, totalFiles);
    const coupling = this.calculateCoupling(edges, totalFiles);
    const cohesion = this.calculateCohesion(edges);
    const layering = ArchitectureScorer.calculateLayering(antiPatterns, totalFiles);

    const w = this.weights;

    const components = [
      {
        name: 'Modularity',
        score: Math.round(modularity),
        maxScore: 100,
        weight: w.modularity,
        explanation: 'Measures appropriate module boundaries and single responsibility principle adherence',
      },
      {
        name: 'Coupling',
        score: Math.round(coupling),
        maxScore: 100,
        weight: w.coupling,
        explanation: 'Evaluates interdependencies between modules; lower coupling is better',
      },
      {
        name: 'Cohesion',
        score: Math.round(cohesion),
        maxScore: 100,
        weight: w.cohesion,
        explanation: 'Assesses how closely related functionality is grouped together',
      },
      {
        name: 'Layering',
        score: Math.round(layering),
        maxScore: 100,
        weight: w.layering,
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

  /**
   * Get the active profile name (for reporting).
   */
  getProfileName(): string {
    return this.profileName;
  }

  // ── Metric calculations (now use adaptive thresholds) ──

  /**
   * Calculate modularity score using adaptive thresholds.
   * Measures how well-bounded modules are by avg edges per file.
   */
  calculateModularity(edges: DependencyEdge[], totalFiles: number): number {
    if (totalFiles === 0) return 50;

    const avgEdgesPerFile = edges.length / totalFiles;
    const t = this.thresholds;

    if (avgEdgesPerFile < t.modularityExcellent) return 100;
    if (avgEdgesPerFile < (t.modularityExcellent + t.modularityGood) / 2) return 85;
    if (avgEdgesPerFile < t.modularityGood) return 70;
    if (avgEdgesPerFile < t.modularityGood * 1.5) return 50;
    return 30;
  }

  /**
   * Calculate coupling score using adaptive thresholds.
   * Evaluates max fan-in/fan-out relative to project size.
   */
  calculateCoupling(edges: DependencyEdge[], totalFiles: number): number {
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
    const t = this.thresholds;

    if (couplingRatio < t.couplingExcellent) return 100;
    if (couplingRatio < (t.couplingExcellent + t.couplingGood) / 2) return 85;
    if (couplingRatio < t.couplingGood) return 75;
    if (couplingRatio < t.couplingGood * 1.5) return 65;
    if (couplingRatio < t.couplingGood * 2) return 50;
    if (couplingRatio < t.couplingGood * 2.5) return 35;
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

  /**
   * Calculate cohesion score using adaptive thresholds.
   * Measures ratio of intra-module vs cross-module dependencies.
   */
  calculateCohesion(edges: DependencyEdge[]): number {
    if (edges.length === 0) return 50;

    const internalEdges = edges.filter((e) =>
      ArchitectureScorer.isInternalDependency(e.from, e.to)
    ).length;

    const cohesionRatio = internalEdges / edges.length;
    const t = this.thresholds;

    if (cohesionRatio > t.cohesionExcellent) return 100;
    if (cohesionRatio > (t.cohesionExcellent + t.cohesionGood) / 2) return 85;
    if (cohesionRatio > t.cohesionGood) return 75;
    if (cohesionRatio > t.cohesionGood * 0.7) return 65;
    if (cohesionRatio > t.cohesionGood * 0.3) return 50;
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

  /**
   * Layering is not threshold-adaptive (anti-pattern based).
   * Kept static for backward compatibility.
   */
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
