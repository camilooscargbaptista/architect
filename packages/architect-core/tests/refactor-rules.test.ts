/**
 * Integration tests for RefactorEngine and individual rules.
 *
 * Key assertions:
 * - Fase 2.1: External deps (fs, path, os, fmt, npm) are filtered by the ENGINE
 *   BEFORE reaching any rule — centralized, not duplicated.
 * - File extensions are language-aware (no hardcoded .py)
 * - Generated content matches target language syntax
 */
import { AnalysisReport } from '../src/core/types/core.js';
import { HubSplitterRule } from '../src/core/rules/hub-splitter.js';
import { ImportOrganizerRule } from '../src/core/rules/import-organizer.js';
import { ModuleGrouperRule } from '../src/core/rules/module-grouper.js';
import { RefactorEngine } from '../src/core/refactor-engine.js';

// ── Helper: Build mock AnalysisReport ──

function createMockReport(overrides?: Partial<AnalysisReport>): AnalysisReport {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      path: '.',
      name: 'TestProject',
      frameworks: [],
      primaryLanguages: ['typescript'],
      totalFiles: 20,
      totalLines: 2000,
    },
    score: {
      overall: 70,
      components: [],
      breakdown: { modularity: 70, coupling: 65, cohesion: 75, layering: 70 },
    },
    antiPatterns: [],
    layers: [],
    dependencyGraph: { nodes: [], edges: [] },
    suggestions: [],
    diagram: { mermaid: '', type: 'component' },
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════
// HUB SPLITTER (rule-level, clean graphs only)
// ══════════════════════════════════════════════════════════════════════

describe('HubSplitterRule', () => {
  const rule = new HubSplitterRule();

  it('should still flag internal hubs with 8+ connections from multiple groups', () => {
    // Consumers from DIFFERENT directories to produce >=2 groups
    const files = [
      'src/auth/login.ts', 'src/auth/signup.ts', 'src/auth/reset.ts',
      'src/api/users.ts', 'src/api/orders.ts', 'src/api/products.ts',
      'src/workers/email.ts', 'src/workers/notify.ts',
      'src/cron/daily.ts', 'src/cron/weekly.ts',
    ];
    const hub = 'src/core/hub-service.ts';
    const nodes = [...files, hub];
    const edges = files.map(f => ({
      from: f, to: hub, type: 'import' as const, weight: 1,
    }));

    const report = createMockReport({
      dependencyGraph: { nodes, edges },
    });

    const steps = rule.analyze(report, '.');
    expect(steps.length).toBeGreaterThanOrEqual(1);
    expect(steps[0]!.title).toContain('hub-service');
  });

  it('should generate .ts extensions for TypeScript projects', () => {
    const files = Array.from({ length: 10 }, (_, i) => `src/layer${i % 3}/consumer-${i}.ts`);
    const hub = 'src/core/big-module.ts';
    const nodes = [...files, hub];
    const edges = files.map(f => ({
      from: f, to: hub, type: 'import' as const, weight: 1,
    }));

    const report = createMockReport({
      dependencyGraph: { nodes, edges },
    });

    const steps = rule.analyze(report, '.');
    if (steps.length > 0) {
      const createOps = steps[0]!.operations.filter(op => op.type === 'CREATE');
      for (const op of createOps) {
        expect(op.path).toMatch(/\.ts$/); // NOT .py
      }
    }
  });

  it('should generate .py extensions for Python projects', () => {
    const files = Array.from({ length: 10 }, (_, i) => `app/layer${i % 3}/consumer_${i}.py`);
    const hub = 'app/core/big_module.py';
    const nodes = [...files, hub];
    const edges = files.map(f => ({
      from: f, to: hub, type: 'import' as const, weight: 1,
    }));

    const report = createMockReport({
      projectInfo: {
        path: '.', name: 'PyProject', frameworks: [],
        primaryLanguages: ['python'], totalFiles: 20, totalLines: 2000,
      },
      dependencyGraph: { nodes, edges },
    });

    const steps = rule.analyze(report, '.');
    if (steps.length > 0) {
      const createOps = steps[0]!.operations.filter(op => op.type === 'CREATE');
      for (const op of createOps) {
        expect(op.path).toMatch(/\.py$/);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// IMPORT ORGANIZER (rule-level, clean graphs only)
// ══════════════════════════════════════════════════════════════════════

describe('ImportOrganizerRule', () => {
  const rule = new ImportOrganizerRule();

  it('should generate language-aware facade extension', () => {
    // Create 5+ internal cross-boundary dirs to trigger the rule
    const dirs = ['src/auth', 'src/db', 'src/utils', 'src/api', 'src/config', 'src/cache'];
    const nodes = ['src/app/orchestrator.ts', ...dirs.map(d => `${d}/index.ts`)];
    const edges = dirs.map(d => ({
      from: 'src/app/orchestrator.ts', to: `${d}/index.ts`, type: 'import' as const, weight: 1,
    }));

    const report = createMockReport({ dependencyGraph: { nodes, edges } });
    const steps = rule.analyze(report, '.');

    if (steps.length > 0) {
      const createOps = steps[0]!.operations.filter(op => op.type === 'CREATE');
      for (const op of createOps) {
        expect(op.path).toMatch(/\.ts$/); // NOT .py
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// MODULE GROUPER (rule-level, clean graphs only)
// ══════════════════════════════════════════════════════════════════════

describe('ModuleGrouperRule', () => {
  const rule = new ModuleGrouperRule();

  it('should generate language-aware init files for Python', () => {
    // Create a scenario where grouping triggers with Python
    const consumers = ['app/a.py', 'app/b.py', 'app/c.py', 'app/d.py'];
    const targets = ['lib/auth/login.py', 'lib/auth/verify.py', 'lib/data/models.py'];
    const nodes = [...consumers, ...targets];

    // Every consumer imports all 3 targets (high co-import)
    const edges = consumers.flatMap(c =>
      targets.map(t => ({ from: c, to: t, type: 'import' as const, weight: 1 })),
    );

    const report = createMockReport({
      projectInfo: {
        path: '.', name: 'PyProject', frameworks: [],
        primaryLanguages: ['python'], totalFiles: 20, totalLines: 2000,
      },
      dependencyGraph: { nodes, edges },
    });

    const steps = rule.analyze(report, '.');

    for (const step of steps) {
      const createOps = step.operations.filter(op => op.type === 'CREATE');
      for (const op of createOps) {
        // Init file should be __init__.py for Python, not index.ts
        if (op.description?.includes('Create new module')) {
          expect(op.path).toContain('__init__.py');
        }
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// REFACTOR ENGINE — Centralized External Dep Filtering (Fase 2.1)
// ══════════════════════════════════════════════════════════════════════

describe('RefactorEngine — Centralized Filtering (Fase 2.1)', () => {
  const engine = new RefactorEngine();

  it('should produce a valid RefactoringPlan without errors', () => {
    const report = createMockReport({
      dependencyGraph: {
        nodes: ['src/a.ts', 'src/b.ts', 'fs', 'path'],
        edges: [
          { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
          { from: 'src/a.ts', to: 'fs', type: 'import', weight: 1 },
        ],
      },
    });

    const plan = engine.analyze(report, '.');
    expect(plan).toBeDefined();
    expect(plan.timestamp).toBeDefined();
    expect(plan.currentScore.overall).toBe(70);
    expect(plan.steps).toBeInstanceOf(Array);
  });

  it('should never reference Node.js stdlib in any step operation', () => {
    const files = Array.from({ length: 12 }, (_, i) => `src/module${i}.ts`);
    const nodes = [...files, 'fs', 'path', 'crypto'];
    const edges = files.flatMap(f => [
      { from: f, to: 'fs', type: 'import' as const, weight: 1 },
      { from: f, to: 'path', type: 'import' as const, weight: 1 },
      { from: f, to: files[(files.indexOf(f) + 1) % files.length]!, type: 'import' as const, weight: 1 },
    ]);

    const report = createMockReport({ dependencyGraph: { nodes, edges } });
    const plan = engine.analyze(report, '.');

    // Stdlib entries should NEVER appear as operation targets
    for (const step of plan.steps) {
      for (const op of step.operations) {
        expect(op.path).not.toBe('fs');
        expect(op.path).not.toBe('path');
        expect(op.path).not.toBe('crypto');
      }
    }
  });

  it('should filter node: prefixed imports', () => {
    const nodes = ['src/app.ts', 'node:fs', 'node:path'];
    const edges = [
      { from: 'src/app.ts', to: 'node:fs', type: 'import' as const, weight: 1 },
      { from: 'src/app.ts', to: 'node:path', type: 'import' as const, weight: 1 },
    ];

    const report = createMockReport({ dependencyGraph: { nodes, edges } });
    const plan = engine.analyze(report, '.');

    for (const step of plan.steps) {
      for (const op of step.operations) {
        expect(op.path).not.toContain('node:');
      }
    }
  });

  it('should filter npm packages (lodash, express) from all rules', () => {
    const files = Array.from({ length: 12 }, (_, i) => `src/layer${i % 4}/module${i}.ts`);
    const nodes = [...files, 'lodash', 'express'];
    const edges = files.flatMap(f => [
      { from: f, to: 'lodash', type: 'import' as const, weight: 1 },
      { from: f, to: 'express', type: 'import' as const, weight: 1 },
    ]);

    const report = createMockReport({ dependencyGraph: { nodes, edges } });
    const plan = engine.analyze(report, '.');

    for (const step of plan.steps) {
      for (const op of step.operations) {
        expect(op.path).not.toBe('lodash');
        expect(op.path).not.toBe('express');
      }
    }
  });

  it('should filter Python stdlib when language=python', () => {
    const files = Array.from({ length: 12 }, (_, i) => `app/layer${i % 4}/module${i}.py`);
    const nodes = [...files, 'os', 'sys', 'json', 'datetime', 'flask'];
    const edges = files.flatMap(f => [
      { from: f, to: 'os', type: 'import' as const, weight: 1 },
      { from: f, to: 'json', type: 'import' as const, weight: 1 },
    ]);

    const report = createMockReport({
      projectInfo: {
        path: '.', name: 'PyProject', frameworks: [],
        primaryLanguages: ['python'], totalFiles: 20, totalLines: 2000,
      },
      dependencyGraph: { nodes, edges },
    });

    const plan = engine.analyze(report, '.');

    for (const step of plan.steps) {
      for (const op of step.operations) {
        expect(op.path).not.toBe('os');
        expect(op.path).not.toBe('sys');
        expect(op.path).not.toBe('json');
        expect(op.path).not.toBe('datetime');
      }
    }
  });

  it('should filter Go stdlib when language=go', () => {
    const files = Array.from({ length: 12 }, (_, i) => `internal/pkg${i % 4}/handler${i}.go`);
    const nodes = [...files, 'fmt', 'net/http', 'encoding/json', 'context'];
    const edges = files.flatMap(f => [
      { from: f, to: 'fmt', type: 'import' as const, weight: 1 },
      { from: f, to: 'net/http', type: 'import' as const, weight: 1 },
    ]);

    const report = createMockReport({
      projectInfo: {
        path: '.', name: 'GoService', frameworks: [],
        primaryLanguages: ['go'], totalFiles: 20, totalLines: 2000,
      },
      dependencyGraph: { nodes, edges },
    });

    const plan = engine.analyze(report, '.');

    for (const step of plan.steps) {
      for (const op of step.operations) {
        expect(op.path).not.toBe('fmt');
        expect(op.path).not.toBe('net/http');
        expect(op.path).not.toBe('encoding/json');
        expect(op.path).not.toBe('context');
      }
    }
  });

  it('should NOT count external imports toward cross-boundary threshold', () => {
    // 3 internal dirs + 4 external = 7 total, but only 3 internal
    const nodes = [
      'src/app/main.ts',
      'src/auth/login.ts', 'src/db/user-repo.ts', 'src/utils/helpers.ts',
      'lodash', 'express', 'zod',
    ];
    const edges = [
      { from: 'src/app/main.ts', to: 'src/auth/login.ts', type: 'import' as const, weight: 1 },
      { from: 'src/app/main.ts', to: 'src/db/user-repo.ts', type: 'import' as const, weight: 1 },
      { from: 'src/app/main.ts', to: 'src/utils/helpers.ts', type: 'import' as const, weight: 1 },
      { from: 'src/app/main.ts', to: 'lodash', type: 'import' as const, weight: 1 },
      { from: 'src/app/main.ts', to: 'express', type: 'import' as const, weight: 1 },
      { from: 'src/app/main.ts', to: 'zod', type: 'import' as const, weight: 1 },
    ];

    const report = createMockReport({ dependencyGraph: { nodes, edges } });
    const plan = engine.analyze(report, '.');

    // Should NOT trigger import-organizer — only 3 internal dirs, not 5+
    const importOrgSteps = plan.steps.filter(s => s.rule === 'import-organizer');
    expect(importOrgSteps).toHaveLength(0);
  });

  it('should preserve internal edges while filtering external ones', () => {
    // Ensure the engine doesn't accidentally remove valid internal edges
    const files = [
      'src/auth/login.ts', 'src/auth/signup.ts', 'src/auth/reset.ts',
      'src/api/users.ts', 'src/api/orders.ts', 'src/api/products.ts',
      'src/workers/email.ts', 'src/workers/notify.ts',
      'src/cron/daily.ts', 'src/cron/weekly.ts',
    ];
    const hub = 'src/core/hub-service.ts';
    const nodes = [...files, hub, 'fs', 'path', 'lodash'];
    const edges = [
      ...files.map(f => ({
        from: f, to: hub, type: 'import' as const, weight: 1,
      })),
      // External edges that should be filtered
      { from: 'src/auth/login.ts', to: 'fs', type: 'import' as const, weight: 1 },
      { from: 'src/api/users.ts', to: 'lodash', type: 'import' as const, weight: 1 },
    ];

    const report = createMockReport({ dependencyGraph: { nodes, edges } });
    const plan = engine.analyze(report, '.');

    // The hub should STILL be detected (10 internal incoming connections)
    const hubSteps = plan.steps.filter(s => s.title.includes('hub-service'));
    expect(hubSteps.length).toBeGreaterThanOrEqual(1);
  });
});
