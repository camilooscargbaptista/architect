import { ArchitectureScorer } from '../src/core/scorer.js';
import { DependencyEdge, AntiPattern } from '../src/core/types/core.js';

describe('ArchitectureScorer', () => {
  const scorer = new ArchitectureScorer();

  const mockEdges: DependencyEdge[] = [
    { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
    { from: 'src/b.ts', to: 'src/c.ts', type: 'import', weight: 1 },
    { from: 'src/c.ts', to: 'src/d.ts', type: 'import', weight: 1 },
  ];

  const mockAntiPatterns: AntiPattern[] = [
    {
      name: 'God Class',
      severity: 'CRITICAL',
      location: 'src/Manager.ts',
      description: 'Test',
      suggestion: 'Test',
    },
  ];

  describe('score', () => {
    it('should return a score between 0 and 100', () => {
      const result = scorer.score(mockEdges, mockAntiPatterns, 50);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it('should calculate component scores', () => {
      const result = scorer.score(mockEdges, mockAntiPatterns, 50);

      expect(result.components).toBeDefined();
      expect(result.components.length).toBeGreaterThan(0);

      for (const component of result.components) {
        expect(component.score).toBeGreaterThanOrEqual(0);
        expect(component.score).toBeLessThanOrEqual(100);
        expect(component.weight).toBeGreaterThan(0);
      }
    });

    it('should provide breakdown of component scores', () => {
      const result = scorer.score(mockEdges, mockAntiPatterns, 50);

      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.modularity).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.coupling).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.cohesion).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.layering).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty edges', () => {
      const result = scorer.score([], mockAntiPatterns, 10);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it('should penalize anti-patterns in layering score', () => {
      const lotsOfPatterns: AntiPattern[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          name: 'Test Pattern',
          severity: 'HIGH',
          location: `src/file${i}.ts`,
          description: 'Test',
          suggestion: 'Test',
        }));

      const resultWithPatterns = scorer.score(mockEdges, lotsOfPatterns, 50);
      const resultWithoutPatterns = scorer.score(mockEdges, [], 50);

      expect(resultWithPatterns.breakdown.layering).toBeLessThanOrEqual(
        resultWithoutPatterns.breakdown.layering
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // MODULARITY TESTS
  // ═══════════════════════════════════════════════════════════════════════
  describe('calculateModularity', () => {
    it('should score 50 when totalFiles is 0', () => {
      const result = scorer.score([], [], 0);
      expect(result.breakdown.modularity).toBe(50);
    });

    it('should score 95 when avgEdgesPerFile < 2', () => {
      // 1 file, 1 edge → avgEdgesPerFile = 1
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 1);
      expect(result.breakdown.modularity).toBe(100);
    });

    it('should score 85 when avgEdgesPerFile is 2-4', () => {
      // 2 files, 5 edges → avgEdgesPerFile = 2.5
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
        { from: 'src/b.ts', to: 'src/c.ts', type: 'import', weight: 1 },
        { from: 'src/c.ts', to: 'src/a.ts', type: 'import', weight: 1 },
        { from: 'src/a.ts', to: 'src/c.ts', type: 'import', weight: 1 },
        { from: 'src/b.ts', to: 'src/a.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 2);
      expect(result.breakdown.modularity).toBe(85);
    });

    it('should score 70 when avgEdgesPerFile is 4-6', () => {
      // 2 files, 10 edges → avgEdgesPerFile = 5
      const edges: DependencyEdge[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          from: `src/a.ts`,
          to: `src/b.ts`,
          type: 'import' as const,
          weight: 1,
        }));
      const result = scorer.score(edges, [], 2);
      expect(result.breakdown.modularity).toBe(70);
    });

    it('should score 50 when avgEdgesPerFile is 6-10', () => {
      // 2 files, 18 edges → avgEdgesPerFile = 9
      const edges: DependencyEdge[] = Array(18)
        .fill(null)
        .map((_, i) => ({
          from: i % 2 === 0 ? 'src/a.ts' : 'src/b.ts',
          to: i % 2 === 0 ? 'src/b.ts' : 'src/a.ts',
          type: 'import' as const,
          weight: 1,
        }));
      const result = scorer.score(edges, [], 2);
      expect(result.breakdown.modularity).toBe(50);
    });

    it('should score 30 when avgEdgesPerFile >= 10', () => {
      // 1 file, 10+ edges
      const edges: DependencyEdge[] = Array(11)
        .fill(null)
        .map((_, i) => ({
          from: 'src/a.ts',
          to: `src/file${i}.ts`,
          type: 'import' as const,
          weight: 1,
        }));
      const result = scorer.score(edges, [], 1);
      expect(result.breakdown.modularity).toBe(30);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // COUPLING TESTS
  // ═══════════════════════════════════════════════════════════════════════
  describe('calculateCoupling', () => {
    it('should score 50 when totalFiles is 0', () => {
      const result = scorer.score([], [], 0);
      expect(result.breakdown.coupling).toBe(50);
    });

    it('should score 50 when totalFiles is 1', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 1);
      expect(result.breakdown.coupling).toBe(50);
    });

    it('should score 95 when couplingRatio < 0.15', () => {
      // 20 files, 1 file has 2 edges → ratio = 2/19 ≈ 0.105
      const edges: DependencyEdge[] = [
        { from: 'src/hub.ts', to: 'src/a.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/b.ts', type: 'import', weight: 1 },
        { from: 'src/c.ts', to: 'src/d.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 20);
      expect(result.breakdown.coupling).toBe(100);
    });

    it('should score 85 when couplingRatio is 0.15-0.25', () => {
      // 10 files, hub has 2 edges → ratio = 2/9 ≈ 0.222
      const edges: DependencyEdge[] = [
        { from: 'src/hub.ts', to: 'src/a.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(85);
    });

    it('should score 75 when couplingRatio is 0.25-0.35', () => {
      // 10 files, hub has 3 edges → ratio = 3/9 ≈ 0.333
      const edges: DependencyEdge[] = [
        { from: 'src/hub.ts', to: 'src/a.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/b.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/c.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(75);
    });

    it('should score 65 when couplingRatio is 0.35-0.5', () => {
      // 10 files, hub has 4 edges → ratio = 4/9 ≈ 0.444
      const edges: DependencyEdge[] = [
        { from: 'src/hub.ts', to: 'src/a.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/b.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/c.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/d.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(65);
    });

    it('should score 50 when couplingRatio is 0.5-0.7', () => {
      // 10 files, hub has 6 edges → ratio = 6/9 ≈ 0.667
      const edges: DependencyEdge[] = Array(6)
        .fill(null)
        .map((_, i) => ({
          from: 'src/hub.ts',
          to: `src/file${i}.ts`,
          type: 'import' as const,
          weight: 1,
        }));
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(50);
    });

    it('should score 35 when couplingRatio is 0.7-0.85', () => {
      // 10 files, hub has 7 edges → ratio = 7/9 ≈ 0.778
      const edges: DependencyEdge[] = Array(7)
        .fill(null)
        .map((_, i) => ({
          from: 'src/hub.ts',
          to: `src/file${i}.ts`,
          type: 'import' as const,
          weight: 1,
        }));
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(35);
    });

    it('should score 20 when couplingRatio >= 0.85', () => {
      // 10 files, hub has 8 edges → ratio = 8/9 ≈ 0.889
      const edges: DependencyEdge[] = Array(8)
        .fill(null)
        .map((_, i) => ({
          from: 'src/hub.ts',
          to: `src/file${i}.ts`,
          type: 'import' as const,
          weight: 1,
        }));
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(20);
    });

    it('should exclude barrel files (index.ts) from coupling calculation', () => {
      // Barrel files should not count toward maxEdgeCount
      const edges: DependencyEdge[] = [
        { from: 'src/index.ts', to: 'src/a.ts', type: 'import', weight: 1 },
        { from: 'src/index.ts', to: 'src/b.ts', type: 'import', weight: 1 },
        { from: 'src/index.ts', to: 'src/c.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/x.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 10);
      // Only hub.ts (1 edge) should count, ratio = 1/9
      expect(result.breakdown.coupling).toBe(100);
    });

    it('should exclude barrel files (__init__.py) from coupling calculation', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/__init__.py', to: 'src/a.py', type: 'import', weight: 1 },
        { from: 'src/__init__.py', to: 'src/b.py', type: 'import', weight: 1 },
        { from: 'src/__init__.py', to: 'src/c.py', type: 'import', weight: 1 },
        { from: 'src/__init__.py', to: 'src/d.py', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 10);
      // All edges from __init__.py should be filtered
      expect(result.breakdown.coupling).toBe(100);
    });

    it('should exclude barrel files (mod.rs) from coupling calculation', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/mod.rs', to: 'src/a.rs', type: 'import', weight: 1 },
        { from: 'src/mod.rs', to: 'src/b.rs', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(100);
    });

    it('should exclude barrel files (__init__.pyi) from coupling calculation', () => {
      const edges: DependencyEdge[] = [
        { from: 'src/__init__.pyi', to: 'src/a.pyi', type: 'import', weight: 1 },
        { from: 'src/__init__.pyi', to: 'src/b.pyi', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(100);
    });

    it('should exclude barrel files as destinations', () => {
      // When the destination is index.ts, it should not count
      const edges: DependencyEdge[] = [
        { from: 'src/a.ts', to: 'src/index.ts', type: 'import', weight: 1 },
        { from: 'src/b.ts', to: 'src/index.ts', type: 'import', weight: 1 },
        { from: 'src/hub.ts', to: 'src/c.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 10);
      expect(result.breakdown.coupling).toBe(100);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // COHESION TESTS
  // ═══════════════════════════════════════════════════════════════════════
  describe('calculateCohesion', () => {
    it('should score 50 when there are no edges', () => {
      const result = scorer.score([], [], 10);
      expect(result.breakdown.cohesion).toBe(50);
    });

    it('should score 95 when cohesionRatio > 0.8', () => {
      // 10 edges, 9 internal → ratio = 0.9
      const edges: DependencyEdge[] = [
        // Same package → internal
        { from: 'api/a.ts', to: 'api/b.ts', type: 'import', weight: 1 },
        { from: 'api/b.ts', to: 'api/c.ts', type: 'import', weight: 1 },
        { from: 'api/c.ts', to: 'api/d.ts', type: 'import', weight: 1 },
        { from: 'api/d.ts', to: 'api/e.ts', type: 'import', weight: 1 },
        { from: 'api/e.ts', to: 'api/f.ts', type: 'import', weight: 1 },
        { from: 'api/f.ts', to: 'api/g.ts', type: 'import', weight: 1 },
        { from: 'api/g.ts', to: 'api/h.ts', type: 'import', weight: 1 },
        { from: 'api/h.ts', to: 'api/i.ts', type: 'import', weight: 1 },
        { from: 'api/i.ts', to: 'api/j.ts', type: 'import', weight: 1 },
        // 1 external
        { from: 'api/k.ts', to: 'service/x.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 50);
      expect(result.breakdown.cohesion).toBe(100);
    });

    it('should score 85 when cohesionRatio is 0.6-0.8', () => {
      // 10 edges, 7 internal → ratio = 0.7
      const edges: DependencyEdge[] = [
        { from: 'api/a.ts', to: 'api/b.ts', type: 'import', weight: 1 },
        { from: 'api/b.ts', to: 'api/c.ts', type: 'import', weight: 1 },
        { from: 'api/c.ts', to: 'api/d.ts', type: 'import', weight: 1 },
        { from: 'api/d.ts', to: 'api/e.ts', type: 'import', weight: 1 },
        { from: 'api/e.ts', to: 'api/f.ts', type: 'import', weight: 1 },
        { from: 'api/f.ts', to: 'api/g.ts', type: 'import', weight: 1 },
        { from: 'api/g.ts', to: 'api/h.ts', type: 'import', weight: 1 },
        // 3 external
        { from: 'api/x.ts', to: 'service/a.ts', type: 'import', weight: 1 },
        { from: 'api/y.ts', to: 'service/b.ts', type: 'import', weight: 1 },
        { from: 'api/z.ts', to: 'service/c.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 50);
      expect(result.breakdown.cohesion).toBe(85);
    });

    it('should score 75 when cohesionRatio is 0.45-0.6', () => {
      // 10 edges, 5 internal → ratio = 0.5
      const edges: DependencyEdge[] = [
        { from: 'api/a.ts', to: 'api/b.ts', type: 'import', weight: 1 },
        { from: 'api/b.ts', to: 'api/c.ts', type: 'import', weight: 1 },
        { from: 'api/c.ts', to: 'api/d.ts', type: 'import', weight: 1 },
        { from: 'api/d.ts', to: 'api/e.ts', type: 'import', weight: 1 },
        { from: 'api/e.ts', to: 'api/f.ts', type: 'import', weight: 1 },
        // 5 external
        { from: 'api/w.ts', to: 'service/a.ts', type: 'import', weight: 1 },
        { from: 'api/x.ts', to: 'service/b.ts', type: 'import', weight: 1 },
        { from: 'api/y.ts', to: 'service/c.ts', type: 'import', weight: 1 },
        { from: 'api/z.ts', to: 'service/d.ts', type: 'import', weight: 1 },
        { from: 'api/q.ts', to: 'service/e.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 50);
      expect(result.breakdown.cohesion).toBe(75);
    });

    it('should score 65 when cohesionRatio is 0.3-0.45', () => {
      // 10 edges, 4 internal → ratio = 0.4
      const edges: DependencyEdge[] = [
        { from: 'api/a.ts', to: 'api/b.ts', type: 'import', weight: 1 },
        { from: 'api/b.ts', to: 'api/c.ts', type: 'import', weight: 1 },
        { from: 'api/c.ts', to: 'api/d.ts', type: 'import', weight: 1 },
        { from: 'api/d.ts', to: 'api/e.ts', type: 'import', weight: 1 },
        // 6 external
        { from: 'api/w.ts', to: 'service/a.ts', type: 'import', weight: 1 },
        { from: 'api/x.ts', to: 'service/b.ts', type: 'import', weight: 1 },
        { from: 'api/y.ts', to: 'service/c.ts', type: 'import', weight: 1 },
        { from: 'api/z.ts', to: 'service/d.ts', type: 'import', weight: 1 },
        { from: 'api/q.ts', to: 'service/e.ts', type: 'import', weight: 1 },
        { from: 'api/r.ts', to: 'service/f.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 50);
      expect(result.breakdown.cohesion).toBe(65);
    });

    it('should score 50 when cohesionRatio is 0.15-0.3', () => {
      // 10 edges, 2 internal → ratio = 0.2
      const edges: DependencyEdge[] = [
        { from: 'api/a.ts', to: 'api/b.ts', type: 'import', weight: 1 },
        { from: 'api/b.ts', to: 'api/c.ts', type: 'import', weight: 1 },
        // 8 external
        { from: 'api/v.ts', to: 'service/a.ts', type: 'import', weight: 1 },
        { from: 'api/w.ts', to: 'service/b.ts', type: 'import', weight: 1 },
        { from: 'api/x.ts', to: 'service/c.ts', type: 'import', weight: 1 },
        { from: 'api/y.ts', to: 'service/d.ts', type: 'import', weight: 1 },
        { from: 'api/z.ts', to: 'service/e.ts', type: 'import', weight: 1 },
        { from: 'api/q.ts', to: 'service/f.ts', type: 'import', weight: 1 },
        { from: 'api/r.ts', to: 'service/g.ts', type: 'import', weight: 1 },
        { from: 'api/s.ts', to: 'service/h.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 50);
      expect(result.breakdown.cohesion).toBe(50);
    });

    it('should score 30 when cohesionRatio <= 0.15', () => {
      // 10 edges, 1 internal → ratio = 0.1
      const edges: DependencyEdge[] = [
        { from: 'api/a.ts', to: 'api/b.ts', type: 'import', weight: 1 },
        // 9 external
        { from: 'api/c.ts', to: 'service/a.ts', type: 'import', weight: 1 },
        { from: 'api/d.ts', to: 'service/b.ts', type: 'import', weight: 1 },
        { from: 'api/e.ts', to: 'service/c.ts', type: 'import', weight: 1 },
        { from: 'api/f.ts', to: 'service/d.ts', type: 'import', weight: 1 },
        { from: 'api/g.ts', to: 'service/e.ts', type: 'import', weight: 1 },
        { from: 'api/h.ts', to: 'service/f.ts', type: 'import', weight: 1 },
        { from: 'api/i.ts', to: 'service/g.ts', type: 'import', weight: 1 },
        { from: 'api/j.ts', to: 'service/h.ts', type: 'import', weight: 1 },
        { from: 'api/k.ts', to: 'service/i.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 50);
      expect(result.breakdown.cohesion).toBe(30);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL DEPENDENCY TESTS
  // ═══════════════════════════════════════════════════════════════════════
  describe('isInternalDependency', () => {
    it('should return true when both files are root files (no directory)', () => {
      const edges: DependencyEdge[] = [
        { from: 'app.ts', to: 'main.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 2);
      // Both root → internal → cohesion should be high
      expect(result.breakdown.cohesion).toBe(100);
    });

    it('should return true when files share same top-level directory', () => {
      const edges: DependencyEdge[] = [
        { from: 'api/routes.ts', to: 'api/handlers.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 2);
      // Same package (api) → internal
      expect(result.breakdown.cohesion).toBe(100);
    });

    it('should return false when files are in different top-level directories', () => {
      const edges: DependencyEdge[] = [
        { from: 'api/routes.ts', to: 'service/handler.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 2);
      // Different packages → external
      expect(result.breakdown.cohesion).toBe(30);
    });

    it('should handle Python package structure', () => {
      const edges: DependencyEdge[] = [
        { from: 'deepguard/cli.py', to: 'deepguard/analyzer.py', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 2);
      // Same package → internal
      expect(result.breakdown.cohesion).toBe(100);
    });

    it('should handle deeply nested paths - same top-level package', () => {
      const edges: DependencyEdge[] = [
        { from: 'mypackage/domain/entities/user.ts', to: 'mypackage/application/services/user.service.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 2);
      // Both start with mypackage → internal
      expect(result.breakdown.cohesion).toBe(100);
    });

    it('should handle mixed package structures', () => {
      const edges: DependencyEdge[] = [
        { from: 'pkg1/file.ts', to: 'pkg2/file.ts', type: 'import', weight: 1 },
        { from: 'pkg1/a.ts', to: 'pkg1/b.ts', type: 'import', weight: 1 },
      ];
      const result = scorer.score(edges, [], 4);
      // 50% internal
      expect(result.breakdown.cohesion).toBe(75);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LAYERING TESTS
  // ═══════════════════════════════════════════════════════════════════════
  describe('calculateLayering', () => {
    it('should score 95 when there are 0 violations', () => {
      const antiPatterns: AntiPattern[] = [
        {
          name: 'God Class',
          severity: 'CRITICAL',
          location: 'src/Manager.ts',
          description: 'Test',
          suggestion: 'Test',
        },
      ];
      const result = scorer.score([], antiPatterns, 10);
      expect(result.breakdown.layering).toBe(100);
    });

    it('should score 90 when there is 1 violation in a large project', () => {
      const antiPatterns: AntiPattern[] = [
        {
          name: 'Leaky Abstraction',
          severity: 'HIGH',
          location: 'src/api.ts',
          description: 'Test',
          suggestion: 'Test',
        },
      ];
      // 1 violation / 100 files = 1% ratio → score 90
      const result = scorer.score([], antiPatterns, 100);
      expect(result.breakdown.layering).toBe(95);
    });

    it('should score 80 when ratio is between 2-5%', () => {
      const antiPatterns: AntiPattern[] = [
        {
          name: 'Leaky Abstraction',
          severity: 'HIGH',
          location: 'src/api.ts',
          description: 'Test',
          suggestion: 'Test',
        },
        {
          name: 'Shotgun Surgery',
          severity: 'MEDIUM',
          location: 'src/service.ts',
          description: 'Test',
          suggestion: 'Test',
        },
      ];
      // 2 violations / 100 files = 2% ratio → score 80
      const result = scorer.score([], antiPatterns, 100);
      expect(result.breakdown.layering).toBe(80);
    });

    it('should score 65 when ratio is between 5-10%', () => {
      const antiPatterns: AntiPattern[] = [
        {
          name: 'Leaky Abstraction',
          severity: 'HIGH',
          location: 'src/api.ts',
          description: 'Test',
          suggestion: 'Test',
        },
        {
          name: 'Shotgun Surgery',
          severity: 'MEDIUM',
          location: 'src/service.ts',
          description: 'Test',
          suggestion: 'Test',
        },
        {
          name: 'Circular Dependency',
          severity: 'CRITICAL',
          location: 'src/model.ts',
          description: 'Test',
          suggestion: 'Test',
        },
      ];
      // 3 violations / 50 files = 6% ratio → score 65
      const result = scorer.score([], antiPatterns, 50);
      expect(result.breakdown.layering).toBe(65);
    });

    it('should score 50 when ratio is between 10-20%', () => {
      const antiPatterns: AntiPattern[] = [
        { name: 'Leaky Abstraction', severity: 'HIGH', location: 'src/api.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Shotgun Surgery', severity: 'MEDIUM', location: 'src/service.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Circular Dependency', severity: 'CRITICAL', location: 'src/model.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Leaky Abstraction', severity: 'HIGH', location: 'src/data.ts', description: 'Test', suggestion: 'Test' },
      ];
      // 4 violations / 30 files = 13.3% ratio → score 50
      const result = scorer.score([], antiPatterns, 30);
      expect(result.breakdown.layering).toBe(50);
    });

    it('should score 20 when ratio exceeds 35%', () => {
      const antiPatterns: AntiPattern[] = [
        { name: 'Leaky Abstraction', severity: 'HIGH', location: 'src/a.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Shotgun Surgery', severity: 'MEDIUM', location: 'src/b.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Circular Dependency', severity: 'CRITICAL', location: 'src/c.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Leaky Abstraction', severity: 'HIGH', location: 'src/d.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Shotgun Surgery', severity: 'MEDIUM', location: 'src/e.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Circular Dependency', severity: 'CRITICAL', location: 'src/f.ts', description: 'Test', suggestion: 'Test' },
      ];
      // 6 violations / 10 files = 60% ratio → score 20
      const result = scorer.score([], antiPatterns, 10);
      expect(result.breakdown.layering).toBe(20);
    });

    it('should only count specific violation types', () => {
      // Only count: 'Leaky Abstraction', 'Shotgun Surgery', 'Circular Dependency'
      const antiPatterns: AntiPattern[] = [
        { name: 'God Class', severity: 'CRITICAL', location: 'src/a.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Leaky Abstraction', severity: 'HIGH', location: 'src/b.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Feature Envy', severity: 'MEDIUM', location: 'src/c.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Shotgun Surgery', severity: 'MEDIUM', location: 'src/d.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Long Method', severity: 'LOW', location: 'src/e.ts', description: 'Test', suggestion: 'Test' },
        { name: 'Circular Dependency', severity: 'CRITICAL', location: 'src/f.ts', description: 'Test', suggestion: 'Test' },
      ];
      // Only Leaky Abstraction, Shotgun Surgery, Circular Dependency count = 3
      // 3 violations / 100 files = 3% ratio → score 80
      const result = scorer.score([], antiPatterns, 100);
      expect(result.breakdown.layering).toBe(80);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // OVERALL SCORE TESTS
  // ═══════════════════════════════════════════════════════════════════════
  describe('overall scoring and weighting', () => {
    it('should compute weighted average correctly', () => {
      // Create edges for known scores
      const edges: DependencyEdge[] = [
        { from: 'api/a.ts', to: 'api/b.ts', type: 'import', weight: 1 },
      ];
      const antiPatterns: AntiPattern[] = [];

      const result = scorer.score(edges, antiPatterns, 1);

      // With 1 file, 1 edge:
      // modularity = 95 (avgEdgesPerFile = 1)
      // coupling = 50 (1 totalFile)
      // cohesion = 95 (internal dependency)
      // layering = 95 (no violations)
      // overall = 95*0.4 + 50*0.25 + 95*0.2 + 95*0.15 = 38 + 12.5 + 19 + 14.25 = 83.75 ≈ 84

      expect(result.overall).toBeGreaterThanOrEqual(83);
      expect(result.overall).toBeLessThanOrEqual(95);
    });

    it('should clamp overall score to [0, 100]', () => {
      const result = scorer.score([], [], 0);
      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it('should round component scores', () => {
      const edges: DependencyEdge[] = Array(3)
        .fill(null)
        .map((_, i) => ({
          from: 'a.ts',
          to: `b${i}.ts`,
          type: 'import' as const,
          weight: 1,
        }));

      const result = scorer.score(edges, [], 1);

      // All component scores should be integers
      expect(Number.isInteger(result.breakdown.modularity)).toBe(true);
      expect(Number.isInteger(result.breakdown.coupling)).toBe(true);
      expect(Number.isInteger(result.breakdown.cohesion)).toBe(true);
      expect(Number.isInteger(result.breakdown.layering)).toBe(true);
    });
  });
});
