import { ArchitectureScorer } from '../src/scorer.js';
import { DependencyEdge, AntiPattern } from '../src/types.js';

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

      expect(resultWithPatterns.breakdown.layering).toBeLessThan(
        resultWithoutPatterns.breakdown.layering
      );
    });
  });
});
