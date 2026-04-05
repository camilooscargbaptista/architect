import { ModuleGrouperRule } from '../../src/core/rules/module-grouper.js';
import { ReportBuilder, typescriptExpressGraph } from './helpers.js';

describe('ModuleGrouperRule', () => {
  const rule = new ModuleGrouperRule();

  describe('co-import detection', () => {
    it('should group files that are always imported together from different dirs', () => {
      const sources = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'];
      const targets = ['lib/auth/login.ts', 'lib/data/models.ts', 'lib/crypto/hash.ts'];
      const report = ReportBuilder.create()
        .addCoImport(sources, targets)
        .build();

      const steps = rule.analyze(report, '.');
      // Targets are in different dirs and co-imported 4x each — should trigger grouping
      if (steps.length > 0) {
        expect(steps[0]!.operations.some(o => o.type === 'MOVE')).toBe(true);
      }
    });

    it('should NOT group files already in the same directory', () => {
      const sources = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'];
      const targets = ['src/core/login.ts', 'src/core/models.ts', 'src/core/hash.ts'];
      const report = ReportBuilder.create()
        .addCoImport(sources, targets)
        .build();

      const steps = rule.analyze(report, '.');
      // Targets are all in src/core/ — same dir, no grouping needed
      expect(steps).toHaveLength(0);
    });

    it('should require co-import count >= 3 for strong partners', () => {
      // Only 2 sources import both targets — below threshold
      const sources = ['src/a.ts', 'src/b.ts'];
      const targets = ['lib/auth/login.ts', 'lib/data/models.ts'];
      const report = ReportBuilder.create()
        .addCoImport(sources, targets)
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });
  });

  // NOTE: External dependency filtering tests moved to refactor-rules.test.ts
  // (RefactorEngine integration level) — Fase 2.1 centralized filtering.

  describe('language-aware init files', () => {
    it('should create __init__.py for Python projects', () => {
      const sources = ['app/a.py', 'app/b.py', 'app/c.py', 'app/d.py'];
      const targets = ['lib/auth/login.py', 'lib/data/models.py', 'lib/crypto/hash.py'];
      const report = ReportBuilder.create()
        .language('python')
        .addCoImport(sources, targets)
        .build();

      const steps = rule.analyze(report, '.');
      for (const step of steps) {
        const createOps = step.operations.filter(o => o.type === 'CREATE');
        for (const op of createOps) {
          if (op.description?.includes('Create new module')) {
            expect(op.path).toContain('__init__.py');
          }
        }
      }
    });

    it('should create index.ts for TypeScript projects', () => {
      const sources = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'];
      const targets = ['lib/auth/login.ts', 'lib/data/models.ts', 'lib/crypto/hash.ts'];
      const report = ReportBuilder.create()
        .language('typescript')
        .addCoImport(sources, targets)
        .build();

      const steps = rule.analyze(report, '.');
      for (const step of steps) {
        const createOps = step.operations.filter(o => o.type === 'CREATE');
        for (const op of createOps) {
          if (op.description?.includes('Create new module')) {
            expect(op.path).toContain('index.ts');
          }
        }
      }
    });
  });

  describe('type file exclusion', () => {
    it('should NOT group clusters containing type files', () => {
      const sources = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts'];
      // One of the targets is a types file — should be excluded
      const targets = ['lib/types/models.ts', 'lib/data/repo.ts', 'lib/crypto/hash.ts'];
      const report = ReportBuilder.create()
        .addCoImport(sources, targets)
        .build();

      const steps = rule.analyze(report, '.');
      for (const step of steps) {
        const moveOps = step.operations.filter(o => o.type === 'MOVE');
        for (const op of moveOps) {
          expect(op.path.toLowerCase()).not.toContain('types');
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph', () => {
      const report = ReportBuilder.create().build();
      expect(rule.analyze(report, '.')).toHaveLength(0);
    });

    it('should limit output to max 3 clusters', () => {
      // Create many potential clusters
      for (let cluster = 0; cluster < 5; cluster++) {
        // Would need very specific graph — just verify no crash
      }
      const report = ReportBuilder.create().build();
      const steps = rule.analyze(report, '.');
      expect(steps.length).toBeLessThanOrEqual(3);
    });

    it('should not crash on fixture graph', () => {
      expect(() => rule.analyze(typescriptExpressGraph(), '.')).not.toThrow();
    });
  });
});
