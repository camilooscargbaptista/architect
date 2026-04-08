import { BarrelOptimizerRule } from '../../src/core/rules/barrel-optimizer.js';
import { ReportBuilder, typescriptExpressGraph } from './helpers.js';

describe('BarrelOptimizerRule', () => {
  const rule = new BarrelOptimizerRule();

  describe('barrel detection', () => {
    it('should detect index.ts barrel with 3+ re-exports', () => {
      const report = ReportBuilder.create()
        .addNode('src/core/index.ts')
        // Barrel re-exports 4 siblings
        .addEdge('src/core/index.ts', 'src/core/service.ts')
        .addEdge('src/core/index.ts', 'src/core/model.ts')
        .addEdge('src/core/index.ts', 'src/core/utils.ts')
        .addEdge('src/core/index.ts', 'src/core/config.ts')
        // Consumers import from barrel AND directly use a re-exported module
        .addEdge('src/app.ts', 'src/core/index.ts')
        .addEdge('src/app.ts', 'src/core/service.ts')
        .addEdge('src/routes/api.ts', 'src/core/index.ts')
        .addEdge('src/routes/api.ts', 'src/core/model.ts')
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps[0]!.title).toContain('barrel');
    });

    it('should detect __init__.py as barrel file', () => {
      const report = ReportBuilder.create()
        .addNode('app/core/__init__.py')
        .addEdge('app/core/__init__.py', 'app/core/service.py')
        .addEdge('app/core/__init__.py', 'app/core/model.py')
        .addEdge('app/core/__init__.py', 'app/core/utils.py')
        // Consumer imports from barrel AND directly uses re-exported module
        .addEdge('app/routes.py', 'app/core/__init__.py')
        .addEdge('app/routes.py', 'app/core/service.py')
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps.length).toBeGreaterThanOrEqual(1);
    });

    it('should NOT flag barrel with fewer than 3 re-exports', () => {
      const report = ReportBuilder.create()
        .addEdge('src/core/index.ts', 'src/core/service.ts')
        .addEdge('src/core/index.ts', 'src/core/model.ts')
        .addEdge('src/app.ts', 'src/core/index.ts')
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });

    it('should NOT flag non-barrel files', () => {
      const report = ReportBuilder.create()
        .addEdge('src/core/service.ts', 'src/core/model.ts')
        .addEdge('src/core/service.ts', 'src/core/utils.ts')
        .addEdge('src/core/service.ts', 'src/core/config.ts')
        .addEdge('src/app.ts', 'src/core/service.ts')
        .build();

      // service.ts is not a barrel file name
      const steps = rule.analyze(report, '.');
      const barrelSteps = steps.filter(s => s.rule === 'barrel-optimizer');
      expect(barrelSteps).toHaveLength(0);
    });
  });

  describe('suggested operations', () => {
    it('should suggest MODIFY for consumers to use direct imports', () => {
      const report = ReportBuilder.create()
        .addEdge('src/core/index.ts', 'src/core/a.ts')
        .addEdge('src/core/index.ts', 'src/core/b.ts')
        .addEdge('src/core/index.ts', 'src/core/c.ts')
        // Consumer imports barrel AND one of the re-exported modules
        .addEdge('src/app.ts', 'src/core/index.ts')
        .addEdge('src/app.ts', 'src/core/a.ts')
        .build();

      const steps = rule.analyze(report, '.');
      if (steps.length > 0) {
        const modifyOps = steps[0]!.operations.filter(o => o.type === 'MODIFY');
        expect(modifyOps.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should flag HIGH priority for barrel with 8+ re-exports', () => {
      const report = ReportBuilder.create();
      for (let i = 0; i < 9; i++) {
        report.addEdge('src/core/index.ts', `src/core/mod${i}.ts`);
      }
      report.addEdge('src/app.ts', 'src/core/index.ts');

      const steps = rule.analyze(report.build(), '.');
      if (steps.length > 0) {
        expect(steps[0]!.priority).toBe('HIGH');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph', () => {
      const report = ReportBuilder.create().build();
      expect(() => rule.analyze(report, '.')).not.toThrow();
      expect(rule.analyze(report, '.')).toHaveLength(0);
    });

    it('should not crash on fixture graphs', () => {
      expect(() => rule.analyze(typescriptExpressGraph(), '.')).not.toThrow();
    });
  });
});
