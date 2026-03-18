import { ArchitectureScore, DependencyEdge, AntiPattern, ScoreComponent } from './types.js';

export class ArchitectureScorer {
  private modularity: number = 0;
  private coupling: number = 0;
  private cohesion: number = 0;
  private layering: number = 0;

  score(
    edges: DependencyEdge[],
    antiPatterns: AntiPattern[],
    totalFiles: number
  ): ArchitectureScore {
    this.calculateModularity(edges, totalFiles);
    this.calculateCoupling(edges, totalFiles);
    this.calculateCohesion(edges);
    this.calculateLayering(antiPatterns);

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
    if (totalFiles === 0) {
      this.coupling = 50;
      return;
    }

    const nodeWithMaxEdges = this.findNodeWithMaxEdges(edges);
    const maxEdgeCount = nodeWithMaxEdges ? nodeWithMaxEdges.count : 0;

    const couplingRatio = maxEdgeCount / (totalFiles - 1);

    if (couplingRatio < 0.2) {
      this.coupling = 95;
    } else if (couplingRatio < 0.4) {
      this.coupling = 85;
    } else if (couplingRatio < 0.6) {
      this.coupling = 70;
    } else if (couplingRatio < 0.8) {
      this.coupling = 50;
    } else {
      this.coupling = 30;
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

    if (cohesionRatio > 0.7) {
      this.cohesion = 95;
    } else if (cohesionRatio > 0.5) {
      this.cohesion = 80;
    } else if (cohesionRatio > 0.3) {
      this.cohesion = 65;
    } else if (cohesionRatio > 0.1) {
      this.cohesion = 45;
    } else {
      this.cohesion = 30;
    }
  }

  private isInternalDependency(from: string, to: string): boolean {
    const fromModule = from.split('/').slice(0, -1).join('/');
    const toModule = to.split('/').slice(0, -1).join('/');
    return fromModule === toModule;
  }

  private calculateLayering(antiPatterns: AntiPattern[]): void {
    const layeringViolations = antiPatterns.filter(
      (p) =>
        p.name === 'Leaky Abstraction' ||
        p.name === 'Shotgun Surgery' ||
        p.name === 'Circular Dependency'
    ).length;

    if (layeringViolations === 0) {
      this.layering = 95;
    } else if (layeringViolations === 1) {
      this.layering = 85;
    } else if (layeringViolations === 2) {
      this.layering = 70;
    } else if (layeringViolations === 3) {
      this.layering = 55;
    } else if (layeringViolations <= 5) {
      this.layering = 40;
    } else {
      this.layering = 25;
    }
  }
}
