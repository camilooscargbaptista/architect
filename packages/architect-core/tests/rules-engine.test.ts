// @ts-ignore
import { RulesEngine } from '../src/core/rules-engine.js';
import { AnalysisReport } from '../src/core/types/core.js';
import { ArchitectRules } from '../src/core/types/architect-rules.js';

describe('RulesEngine', () => {
  let engine: RulesEngine;
  let mockReport: AnalysisReport;

  beforeEach(() => {
    engine = new RulesEngine();
    mockReport = {
      timestamp: new Date().toISOString(),
      projectInfo: { path: '.', name: 'Test', frameworks: [], primaryLanguages: ['typescript'], totalFiles: 10, totalLines: 100 },
      score: {
        overall: 85,
        components: [],
        breakdown: { modularity: 80, coupling: 90, cohesion: 85, layering: 85 },
      },
      antiPatterns: [
        { name: 'God Class', severity: 'HIGH', location: 'file1.ts', description: 'x', suggestion: 'y' },
        { name: 'Circular Dependency', severity: 'CRITICAL', location: 'file2.ts', description: 'x', suggestion: 'y' }
      ],
      layers: [],
      dependencyGraph: {
        nodes: ['src/a.ts', 'src/b.ts', 'node_modules/lodash/index.js'],
        edges: [
          { from: 'src/a.ts', to: 'node_modules/lodash/index.js', type: 'import', weight: 1 }
        ]
      },
      suggestions: [],
      diagram: { mermaid: '', type: 'component' }
    };
  });

  describe('Quality Gates', () => {
    it('should fail if overall score is below minimum', () => {
      const rules: ArchitectRules = {
        version: '1.0',
        quality_gates: { min_overall_score: 90 } // Report has 85
      };

      const result = engine.validate(mockReport, rules);
      expect(result.success).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]!.rule).toBe('quality_gates.min_overall_score');
      expect(result.violations[0]!.level).toBe('error');
    });

    it('should pass if overall score meets minimum', () => {
      const rules: ArchitectRules = {
        version: '1.0',
        quality_gates: { min_overall_score: 80 } 
      };

      const result = engine.validate(mockReport, rules);
      expect(result.success).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail if critical anti-patterns exceed max', () => {
      const rules: ArchitectRules = {
        version: '1.0',
        quality_gates: { max_critical_anti_patterns: 0 } // Report has 1
      };

      const result = engine.validate(mockReport, rules);
      expect(result.success).toBe(false);
      expect(result.violations[0]!.rule).toBe('quality_gates.max_critical_anti_patterns');
    });

    it('should issue warning if high anti-patterns exceed max', () => {
      const rules: ArchitectRules = {
        version: '1.0',
        quality_gates: { max_high_anti_patterns: 0 } // Report has 1 High, 1 Critical
      };

      const result = engine.validate(mockReport, rules);
      // Warnings do not fail the build
      expect(result.success).toBe(true);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]!.level).toBe('warning');
      expect(result.violations[0]!.rule).toBe('quality_gates.max_high_anti_patterns');
    });
  });

  describe('Boundaries', () => {
    it('should fail if circular dependencies are found and not allowed', () => {
      const rules: ArchitectRules = {
        version: '1.0',
        boundaries: { allow_circular_dependencies: false }
      };

      const result = engine.validate(mockReport, rules);
      expect(result.success).toBe(false);
      expect(result.violations[0]!.rule).toBe('boundaries.allow_circular_dependencies');
    });

    it('should pass if circular dependencies are allowed', () => {
      const rules: ArchitectRules = {
        version: '1.0',
        boundaries: { allow_circular_dependencies: true }
      };

      const result = engine.validate(mockReport, rules);
      expect(result.success).toBe(true);
    });

    it('should fail if banned imports are used', () => {
      const rules: ArchitectRules = {
        version: '1.0',
        boundaries: { banned_imports: ['lodash'] }
      };

      const result = engine.validate(mockReport, rules);
      expect(result.success).toBe(false);
      expect(result.violations[0]!.rule).toBe('boundaries.banned_imports');
      expect(result.violations[0]!.message).toContain('lodash');
    });

    it('should pass if banned imports are not used', () => {
      const rules: ArchitectRules = {
        version: '1.0',
        boundaries: { banned_imports: ['underscore'] } // Report uses lodash, not underscore
      };

      const result = engine.validate(mockReport, rules);
      expect(result.success).toBe(true);
    });
  });
});
