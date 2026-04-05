import { HubSplitterRule } from '../../src/core/rules/hub-splitter.js';
import { ReportBuilder, typescriptExpressGraph, pythonFlaskGraph, goMicroserviceGraph } from './helpers.js';

describe('HubSplitterRule', () => {
  const rule = new HubSplitterRule();

  // NOTE: External dependency filtering tests moved to refactor-rules.test.ts
  // (RefactorEngine integration level) — Fase 2.1 centralized filtering.

  // ── Positive Cases ─────────────────────────────────────────────────

  describe('hub detection', () => {
    it('should generate split for internal hub with 8+ incoming deps from multiple groups', () => {
      const dependents = [
        'src/auth/login.ts', 'src/auth/signup.ts', 'src/auth/reset.ts',
        'src/api/users.ts', 'src/api/orders.ts', 'src/api/products.ts',
        'src/workers/email.ts', 'src/workers/notify.ts',
        'src/cron/daily.ts',
      ];
      const report = ReportBuilder.create()
        .addHub('src/core/big-service.ts', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps[0]!.title).toContain('big-service');
      expect(steps[0]!.priority).toBe('CRITICAL');
    });

    it('should NOT flag file with fewer than 8 incoming connections', () => {
      const dependents = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts'];
      const report = ReportBuilder.create()
        .addHub('src/core/small-service.ts', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });

    it('should exclude barrel files from hub detection', () => {
      const dependents = Array.from({ length: 10 }, (_, i) => `src/m${i}/file.ts`);
      const report = ReportBuilder.create()
        .addHub('src/core/index.ts', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });

    it('should exclude __init__.py barrel files for Python', () => {
      const dependents = Array.from({ length: 10 }, (_, i) => `app/m${i}/file.py`);
      const report = ReportBuilder.create()
        .language('python')
        .addHub('app/core/__init__.py', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });

    it('should exclude type-only files from hub detection', () => {
      const dependents = Array.from({ length: 10 }, (_, i) => `src/m${i}/file.ts`);
      const report = ReportBuilder.create()
        .addHub('src/types/models.ts', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });

    it('should group dependents by top-level directory correctly', () => {
      const dependents = [
        'src/auth/a.ts', 'src/auth/b.ts',
        'src/api/c.ts', 'src/api/d.ts',
        'src/workers/e.ts', 'src/workers/f.ts',
        'src/cron/g.ts', 'src/cron/h.ts',
        'src/middleware/i.ts',
      ];
      const report = ReportBuilder.create()
        .addHub('src/core/hub.ts', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      if (steps.length > 0) {
        const createOps = steps[0]!.operations.filter(o => o.type === 'CREATE');
        expect(createOps.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  // ── Language-Aware Extensions ──────────────────────────────────────

  describe('file extension handling', () => {
    it('should use .ts for TypeScript projects', () => {
      const dependents = [
        'src/auth/a.ts', 'src/auth/b.ts', 'src/api/c.ts', 'src/api/d.ts',
        'src/workers/e.ts', 'src/workers/f.ts', 'src/cron/g.ts', 'src/cron/h.ts',
        'src/misc/i.ts',
      ];
      const report = ReportBuilder.create()
        .language('typescript')
        .addHub('src/core/hub.ts', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      for (const step of steps) {
        for (const op of step.operations.filter(o => o.type === 'CREATE')) {
          expect(op.path).toMatch(/\.ts$/);
        }
      }
    });

    it('should use .py for Python projects', () => {
      const dependents = [
        'app/auth/a.py', 'app/auth/b.py', 'app/api/c.py', 'app/api/d.py',
        'app/workers/e.py', 'app/workers/f.py', 'app/cron/g.py', 'app/cron/h.py',
        'app/misc/i.py',
      ];
      const report = ReportBuilder.create()
        .language('python')
        .addHub('app/core/hub.py', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      for (const step of steps) {
        for (const op of step.operations.filter(o => o.type === 'CREATE')) {
          expect(op.path).toMatch(/\.py$/);
        }
      }
    });

    it('should use .go for Go projects', () => {
      const dependents = [
        'internal/auth/a.go', 'internal/auth/b.go', 'internal/api/c.go',
        'internal/api/d.go', 'internal/workers/e.go', 'internal/workers/f.go',
        'internal/cron/g.go', 'internal/cron/h.go', 'internal/misc/i.go',
      ];
      const report = ReportBuilder.create()
        .language('go')
        .addHub('internal/core/hub.go', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      for (const step of steps) {
        for (const op of step.operations.filter(o => o.type === 'CREATE')) {
          expect(op.path).toMatch(/\.go$/);
        }
      }
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty dependency graph', () => {
      const report = ReportBuilder.create().build();
      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });

    it('should handle circular dependencies gracefully', () => {
      const report = ReportBuilder.create()
        .addEdge('src/a.ts', 'src/b.ts')
        .addEdge('src/b.ts', 'src/a.ts')
        .build();

      expect(() => rule.analyze(report, '.')).not.toThrow();
    });

    it('should produce valid file paths in operations', () => {
      const dependents = Array.from({ length: 10 }, (_, i) => `src/layer${i % 4}/m${i}.ts`);
      const report = ReportBuilder.create()
        .addHub('src/core/service.ts', dependents)
        .build();

      const steps = rule.analyze(report, '.');
      for (const step of steps) {
        for (const op of step.operations) {
          expect(op.path).not.toContain('//');
          expect(op.path).not.toContain('undefined');
          expect(op.path.length).toBeGreaterThan(0);
        }
      }
    });

    it('should not crash on fixture graphs', () => {
      expect(() => rule.analyze(typescriptExpressGraph(), '.')).not.toThrow();
      expect(() => rule.analyze(pythonFlaskGraph(), '.')).not.toThrow();
      expect(() => rule.analyze(goMicroserviceGraph(), '.')).not.toThrow();
    });
  });
});
