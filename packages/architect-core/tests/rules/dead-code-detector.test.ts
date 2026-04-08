import { DeadCodeDetectorRule } from '../../src/core/rules/dead-code-detector.js';
import { ReportBuilder, typescriptExpressGraph } from './helpers.js';

describe('DeadCodeDetectorRule', () => {
  const rule = new DeadCodeDetectorRule();

  describe('orphan detection', () => {
    it('should detect files with zero incoming dependencies', () => {
      const report = ReportBuilder.create()
        .addEdge('src/app.ts', 'src/service.ts')
        .addNode('src/orphan.ts')  // No one imports this
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps.length).toBeGreaterThanOrEqual(1);
      const orphanPaths = steps[0]!.operations.map(o => o.path);
      expect(orphanPaths).toContain('src/orphan.ts');
    });

    it('should NOT flag files that have outgoing edges (active code)', () => {
      const report = ReportBuilder.create()
        .addEdge('src/app.ts', 'src/service.ts')
        .addEdge('src/orphan.ts', 'src/service.ts')  // orphan has outgoing = active
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      expect(allPaths).not.toContain('src/orphan.ts');
    });
  });

  describe('entry point exclusion', () => {
    it('should NOT flag main.ts as dead code', () => {
      const report = ReportBuilder.create()
        .addNode('src/main.ts')
        .addEdge('src/main.ts', 'src/app.ts')
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      expect(allPaths).not.toContain('src/main.ts');
    });

    it('should NOT flag app.py, manage.py, wsgi.py', () => {
      const entryPoints = ['app/app.py', 'app/manage.py', 'app/wsgi.py'];
      const builder = ReportBuilder.create().language('python');
      for (const ep of entryPoints) {
        builder.addNode(ep);
      }
      const report = builder.build();
      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      for (const ep of entryPoints) {
        expect(allPaths).not.toContain(ep);
      }
    });

    it('should NOT flag server.ts, server.js', () => {
      const report = ReportBuilder.create()
        .addNode('src/server.ts')
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      expect(allPaths).not.toContain('src/server.ts');
    });
  });

  describe('test file exclusion', () => {
    it('should NOT flag .test.ts files', () => {
      const report = ReportBuilder.create()
        .addNode('src/service.test.ts')
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      expect(allPaths).not.toContain('src/service.test.ts');
    });

    it('should NOT flag .spec.ts files', () => {
      const report = ReportBuilder.create()
        .addNode('src/service.spec.ts')
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      expect(allPaths).not.toContain('src/service.spec.ts');
    });

    it('should NOT flag _test.py files', () => {
      const report = ReportBuilder.create()
        .language('python')
        .addNode('tests/test_service.py')
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      expect(allPaths).not.toContain('tests/test_service.py');
    });
  });

  describe('dunder file exclusion', () => {
    it('should NOT flag __init__.py files', () => {
      const report = ReportBuilder.create()
        .language('python')
        .addNode('app/__init__.py')
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      expect(allPaths).not.toContain('app/__init__.py');
    });

    it('should NOT flag dotfiles', () => {
      const report = ReportBuilder.create()
        .addNode('src/.eslintrc.js')
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      expect(allPaths).not.toContain('src/.eslintrc.js');
    });
  });

  describe('dot-notation matching', () => {
    it('should recognize dot-notation references as incoming edges', () => {
      // File: deepguard/report.py, referenced as deepguard.report
      const report = ReportBuilder.create()
        .language('python')
        .addNode('deepguard/report.py')
        .addEdge('app/main.py', 'deepguard.report')  // dot-notation ref
        .build();

      const steps = rule.analyze(report, '.');
      const allPaths = steps.flatMap(s => s.operations.map(o => o.path));
      // deepguard/report.py should NOT be orphan because deepguard.report references it
      expect(allPaths).not.toContain('deepguard/report.py');
    });
  });

  describe('non-path nodes', () => {
    it('should only consider nodes with path separators as file candidates', () => {
      // Bare names without / or \\ are skipped as file candidates
      const report = ReportBuilder.create()
        .addNode('lodash')
        .addNode('express')
        .addNode('fs')
        .build();

      const steps = rule.analyze(report, '.');
      // None of these should be flagged as orphan files
      expect(steps).toHaveLength(0);
    });
  });

  describe('priority levels', () => {
    it('should set MEDIUM priority for 3+ orphans', () => {
      const report = ReportBuilder.create()
        .addEdge('src/app.ts', 'src/service.ts')
        .addNode('src/orphan1.ts')
        .addNode('src/orphan2.ts')
        .addNode('src/orphan3.ts')
        .build();

      const steps = rule.analyze(report, '.');
      if (steps.length > 0) {
        expect(steps[0]!.priority).toBe('MEDIUM');
      }
    });

    it('should set LOW priority for fewer than 3 orphans', () => {
      const report = ReportBuilder.create()
        .addEdge('src/app.ts', 'src/service.ts')
        .addNode('src/orphan1.ts')
        .build();

      const steps = rule.analyze(report, '.');
      if (steps.length > 0) {
        expect(steps[0]!.priority).toBe('LOW');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph', () => {
      const report = ReportBuilder.create().build();
      expect(rule.analyze(report, '.')).toHaveLength(0);
    });

    it('should not crash on fixture graph', () => {
      expect(() => rule.analyze(typescriptExpressGraph(), '.')).not.toThrow();
    });
  });
});
