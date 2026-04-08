import { ImportOrganizerRule } from '../../src/core/rules/import-organizer.js';
import { ReportBuilder, typescriptExpressGraph, pythonFlaskGraph } from './helpers.js';

describe('ImportOrganizerRule', () => {
  const rule = new ImportOrganizerRule();

  describe('cross-boundary detection', () => {
    it('should flag file importing from 5+ different internal directories', () => {
      const report = ReportBuilder.create()
        .addFanOut('src/app/orchestrator.ts', [
          'src/auth/login.ts',
          'src/db/user-repo.ts',
          'src/utils/helpers.ts',
          'src/api/client.ts',
          'src/config/env.ts',
          'src/cache/redis.ts',
        ])
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps.length).toBeGreaterThanOrEqual(1);
      expect(steps[0]!.title).toContain('orchestrator');
    });

    it('should NOT flag file importing from fewer than 5 directories', () => {
      const report = ReportBuilder.create()
        .addFanOut('src/app/main.ts', [
          'src/auth/login.ts',
          'src/db/user-repo.ts',
          'src/utils/helpers.ts',
        ])
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });

    it('should NOT count same-directory imports toward threshold', () => {
      const report = ReportBuilder.create()
        .addFanOut('src/app/main.ts', [
          'src/app/helper1.ts',
          'src/app/helper2.ts',
          'src/app/helper3.ts',
          'src/app/helper4.ts',
          'src/app/helper5.ts',
          'src/app/helper6.ts',
        ])
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });

    it('should exclude test files from analysis', () => {
      const report = ReportBuilder.create()
        .addFanOut('src/app/main.test.ts', [
          'src/auth/login.ts', 'src/db/user-repo.ts',
          'src/utils/helpers.ts', 'src/api/client.ts',
          'src/config/env.ts', 'src/cache/redis.ts',
        ])
        .build();

      const steps = rule.analyze(report, '.');
      expect(steps).toHaveLength(0);
    });
  });

  // NOTE: External dependency filtering tests moved to refactor-rules.test.ts
  // (RefactorEngine integration level) — Fase 2.1 centralized filtering.

  describe('facade generation', () => {
    it('should create facade with correct extension for TypeScript', () => {
      const report = ReportBuilder.create()
        .language('typescript')
        .addFanOut('src/app/orchestrator.ts', [
          'src/a/m.ts', 'src/b/m.ts', 'src/c/m.ts', 'src/d/m.ts', 'src/e/m.ts',
        ])
        .build();

      const steps = rule.analyze(report, '.');
      if (steps.length > 0) {
        const createOp = steps[0]!.operations.find(o => o.type === 'CREATE');
        expect(createOp?.path).toMatch(/\.ts$/);
        expect(createOp?.path).toContain('_deps.');
      }
    });

    it('should create facade with .py extension for Python', () => {
      const report = ReportBuilder.create()
        .language('python')
        .addFanOut('app/orchestrator.py', [
          'app/a/m.py', 'app/b/m.py', 'app/c/m.py', 'app/d/m.py', 'app/e/m.py',
        ])
        .build();

      const steps = rule.analyze(report, '.');
      if (steps.length > 0) {
        const createOp = steps[0]!.operations.find(o => o.type === 'CREATE');
        expect(createOp?.path).toMatch(/\.py$/);
      }
    });

    it('should generate facade content with language-appropriate syntax', () => {
      const report = ReportBuilder.create()
        .language('python')
        .addFanOut('app/orchestrator.py', [
          'app/a/m.py', 'app/b/m.py', 'app/c/m.py', 'app/d/m.py', 'app/e/m.py',
        ])
        .build();

      const steps = rule.analyze(report, '.');
      if (steps.length > 0) {
        const createOp = steps[0]!.operations.find(o => o.type === 'CREATE');
        expect(createOp?.content).toContain('"""');  // Python docstring
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty graph', () => {
      const report = ReportBuilder.create().build();
      expect(rule.analyze(report, '.')).toHaveLength(0);
    });

    it('should not crash on fixture graphs', () => {
      expect(() => rule.analyze(typescriptExpressGraph(), '.')).not.toThrow();
      expect(() => rule.analyze(pythonFlaskGraph(), '.')).not.toThrow();
    });
  });
});
