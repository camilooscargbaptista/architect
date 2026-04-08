import { MultiPassGenerator } from '../src/core/agent-runtime/multi-pass-generator.js';
import { RefactorStep, FileOperation } from '@girardelli/architect-core/src/core/types/rules.js';

// ── Helpers ──────────────────────────────────────────────────────

function op(type: FileOperation['type'], path: string, extra?: Partial<FileOperation>): FileOperation {
  return { type, path, description: `${type} ${path}`, ...extra };
}

function makeStep(rule: string, ops: FileOperation[], overrides?: Partial<RefactorStep>): RefactorStep {
  return {
    id: 1,
    tier: 1,
    rule,
    priority: 'HIGH',
    title: `Test step for ${rule}`,
    description: `Description for ${rule}`,
    rationale: 'Improve modularity',
    operations: ops,
    scoreImpact: [{ metric: 'modularity', before: 55, after: 75 }],
    aiPrompt: `Refactor using ${rule}`,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('MultiPassGenerator', () => {
  let generator: MultiPassGenerator;

  beforeEach(() => {
    generator = new MultiPassGenerator();
  });

  describe('decompose()', () => {
    it('should return a PromptChain with correct metadata', () => {
      const step = makeStep('hub-splitter', [
        op('CREATE', 'src/utils_auth.ts'),
        op('MODIFY', 'src/utils.ts', { description: 'Refactor utils — extract auth' }),
        op('MODIFY', 'src/app.ts', { description: 'Update imports in app.ts' }),
      ]);

      const chain = generator.decompose(step);

      expect(chain.stepId).toBe(step.id);
      expect(chain.stepTitle).toBe(step.title);
      expect(chain.rule).toBe('hub-splitter');
      expect(chain.passCount).toBe(chain.passes.length);
    });
  });

  // ── Hub Splitter: 3 passes ────────────────────────────────────

  describe('hub-splitter strategy', () => {
    const hubStep = makeStep('hub-splitter', [
      op('CREATE', 'src/utils_auth.ts'),
      op('CREATE', 'src/utils_api.ts'),
      op('MODIFY', 'src/utils.ts', { description: 'Refactor utils.ts — extract grouped functionality' }),
      op('MODIFY', 'src/app.ts', { description: 'Update imports in app.ts' }),
      op('MODIFY', 'src/server.ts', { description: 'Update imports in server.ts' }),
    ]);

    it('should decompose into 3 passes', () => {
      const chain = generator.decompose(hubStep);
      expect(chain.passCount).toBe(3);
    });

    it('pass 1 should analyze with source context', () => {
      const chain = generator.decompose(hubStep);
      const pass1 = chain.passes[0]!;

      expect(pass1.passNumber).toBe(1);
      expect(pass1.contextSource).toBe('source');
      expect(pass1.dependsOn).toBeUndefined();
      expect(pass1.objective).toContain('Analyze');
      expect(pass1.outputContract).toContain('JSON');
    });

    it('pass 2 should generate code from previous analysis', () => {
      const chain = generator.decompose(hubStep);
      const pass2 = chain.passes[1]!;

      expect(pass2.passNumber).toBe(2);
      expect(pass2.contextSource).toBe('previous');
      expect(pass2.dependsOn).toBe(1);
      expect(pass2.objective).toContain('split module');
      expect(pass2.content).toContain('utils_auth.ts');
      expect(pass2.content).toContain('utils_api.ts');
    });

    it('pass 3 should update consumers from previous output', () => {
      const chain = generator.decompose(hubStep);
      const pass3 = chain.passes[2]!;

      expect(pass3.passNumber).toBe(3);
      expect(pass3.contextSource).toBe('previous');
      expect(pass3.dependsOn).toBe(2);
      expect(pass3.objective).toContain('consumer');
      expect(pass3.content).toContain('app.ts');
      expect(pass3.content).toContain('server.ts');
    });

    it('all passes should include rule and rationale in content', () => {
      const chain = generator.decompose(hubStep);
      for (const pass of chain.passes) {
        expect(pass.content).toContain('hub-splitter');
        expect(pass.content).toContain('Improve modularity');
      }
    });
  });

  // ── Barrel Optimizer: 2 passes ────────────────────────────────

  describe('barrel-optimizer strategy', () => {
    const barrelStep = makeStep('barrel-optimizer', [
      op('MODIFY', 'src/index.ts', { description: 'Simplify barrel — remove internal re-exports' }),
      op('MODIFY', 'src/app.ts', { description: 'Replace barrel import with direct import' }),
      op('MODIFY', 'src/server.ts', { description: 'Replace barrel import with direct import' }),
    ]);

    it('should decompose into 2 passes', () => {
      const chain = generator.decompose(barrelStep);
      expect(chain.passCount).toBe(2);
    });

    it('pass 1 should analyze barrel exports', () => {
      const chain = generator.decompose(barrelStep);
      const pass1 = chain.passes[0]!;

      expect(pass1.passNumber).toBe(1);
      expect(pass1.contextSource).toBe('source');
      expect(pass1.outputContract).toContain('JSON');
      expect(pass1.content).toContain('index.ts');
    });

    it('pass 2 should replace imports using analysis', () => {
      const chain = generator.decompose(barrelStep);
      const pass2 = chain.passes[1]!;

      expect(pass2.passNumber).toBe(2);
      expect(pass2.contextSource).toBe('previous');
      expect(pass2.dependsOn).toBe(1);
      expect(pass2.content).toContain('direct import');
    });
  });

  // ── Import Organizer: 2 passes ────────────────────────────────

  describe('import-organizer strategy', () => {
    const importStep = makeStep('import-organizer', [
      op('CREATE', 'src/core/deps.ts', { description: 'Create dependency facade' }),
      op('MODIFY', 'src/core/engine.ts', { description: 'Rewire imports to use facade' }),
    ]);

    it('should decompose into 2 passes', () => {
      const chain = generator.decompose(importStep);
      expect(chain.passCount).toBe(2);
    });

    it('pass 1 should generate facade from source', () => {
      const chain = generator.decompose(importStep);
      const pass1 = chain.passes[0]!;

      expect(pass1.passNumber).toBe(1);
      expect(pass1.contextSource).toBe('source');
      expect(pass1.content).toContain('deps.ts');
      expect(pass1.objective).toContain('facade');
    });

    it('pass 2 should rewire imports', () => {
      const chain = generator.decompose(importStep);
      const pass2 = chain.passes[1]!;

      expect(pass2.passNumber).toBe(2);
      expect(pass2.contextSource).toBe('previous');
      expect(pass2.dependsOn).toBe(1);
      expect(pass2.content).toContain('engine.ts');
    });
  });

  // ── Module Grouper: 3 passes ──────────────────────────────────

  describe('module-grouper strategy', () => {
    const groupStep = makeStep('module-grouper', [
      op('MOVE', 'src/auth.ts', { newPath: 'src/auth/auth.ts' }),
      op('MOVE', 'src/login.ts', { newPath: 'src/auth/login.ts' }),
      op('CREATE', 'src/auth/index.ts'),
    ]);

    it('should decompose into 3 passes', () => {
      const chain = generator.decompose(groupStep);
      expect(chain.passCount).toBe(3);
    });

    it('pass 1 should analyze grouping', () => {
      const chain = generator.decompose(groupStep);
      const pass1 = chain.passes[0]!;

      expect(pass1.passNumber).toBe(1);
      expect(pass1.contextSource).toBe('source');
      expect(pass1.content).toContain('auth.ts');
      expect(pass1.content).toContain('login.ts');
    });

    it('pass 2 should execute moves', () => {
      const chain = generator.decompose(groupStep);
      const pass2 = chain.passes[1]!;

      expect(pass2.passNumber).toBe(2);
      expect(pass2.dependsOn).toBe(1);
    });

    it('pass 3 should fix broken imports', () => {
      const chain = generator.decompose(groupStep);
      const pass3 = chain.passes[2]!;

      expect(pass3.passNumber).toBe(3);
      expect(pass3.dependsOn).toBe(2);
      expect(pass3.content).toContain('auth.ts');
    });
  });

  // ── Dead Code Detector: 1 pass ────────────────────────────────

  describe('dead-code-detector strategy', () => {
    const deadStep = makeStep('dead-code-detector', [
      op('DELETE', 'src/unused.ts', { description: 'No incoming dependencies detected' }),
      op('DELETE', 'src/legacy.ts', { description: 'Deprecated module with 0 imports' }),
    ]);

    it('should decompose into 1 pass', () => {
      const chain = generator.decompose(deadStep);
      expect(chain.passCount).toBe(1);
    });

    it('single pass should verify and remove', () => {
      const chain = generator.decompose(deadStep);
      const pass1 = chain.passes[0]!;

      expect(pass1.passNumber).toBe(1);
      expect(pass1.contextSource).toBe('source');
      expect(pass1.dependsOn).toBeUndefined();
      expect(pass1.content).toContain('unused.ts');
      expect(pass1.content).toContain('legacy.ts');
    });
  });

  // ── Default fallback: 1 pass ──────────────────────────────────

  describe('default strategy (unknown rule)', () => {
    it('should wrap aiPrompt in single pass', () => {
      const step = makeStep('custom-rule', [
        op('MODIFY', 'src/app.ts'),
      ], { aiPrompt: 'Do something custom' });

      const chain = generator.decompose(step);

      expect(chain.passCount).toBe(1);
      expect(chain.passes[0]!.passNumber).toBe(1);
      expect(chain.passes[0]!.contextSource).toBe('source');
      expect(chain.passes[0]!.content).toBe('Do something custom');
    });

    it('should generate fallback prompt when no aiPrompt', () => {
      const step: RefactorStep = {
        ...makeStep('unknown-rule', [op('MODIFY', 'src/app.ts')]),
      };
      delete (step as unknown as Record<string, unknown>)['aiPrompt'];

      const chain = generator.decompose(step);

      expect(chain.passCount).toBe(1);
      expect(chain.passes[0]!.content).toContain('unknown-rule');
      expect(chain.passes[0]!.content).toContain(step.description);
    });
  });

  // ── Chain invariants ──────────────────────────────────────────

  describe('chain invariants', () => {
    it('passes should have sequential passNumbers starting at 1', () => {
      const rules = ['hub-splitter', 'barrel-optimizer', 'import-organizer', 'module-grouper', 'dead-code-detector'];

      for (const rule of rules) {
        const step = makeStep(rule, [
          op('CREATE', 'src/new.ts'),
          op('MODIFY', 'src/old.ts', { description: 'Refactor old.ts — extract' }),
          op('MODIFY', 'src/consumer.ts', { description: 'Update imports in consumer' }),
          op('MOVE', 'src/a.ts', { newPath: 'src/group/a.ts' }),
          op('DELETE', 'src/dead.ts', { description: 'No dependencies' }),
        ]);

        const chain = generator.decompose(step);

        for (let i = 0; i < chain.passes.length; i++) {
          expect(chain.passes[i]!.passNumber).toBe(i + 1);
        }
      }
    });

    it('dependsOn should reference valid previous passes', () => {
      const step = makeStep('hub-splitter', [
        op('CREATE', 'src/a.ts'),
        op('MODIFY', 'src/hub.ts', { description: 'Refactor hub' }),
        op('MODIFY', 'src/consumer.ts', { description: 'Update imports' }),
      ]);

      const chain = generator.decompose(step);

      for (const pass of chain.passes) {
        if (pass.dependsOn !== undefined) {
          expect(pass.dependsOn).toBeLessThan(pass.passNumber);
          expect(pass.dependsOn).toBeGreaterThanOrEqual(1);
        }
      }
    });

    it('passCount should match passes array length', () => {
      const rules = ['hub-splitter', 'barrel-optimizer', 'dead-code-detector', 'unknown'];

      for (const rule of rules) {
        const step = makeStep(rule, [
          op('CREATE', 'src/new.ts'),
          op('MODIFY', 'src/old.ts', { description: 'Refactor' }),
          op('DELETE', 'src/dead.ts', { description: 'Remove' }),
        ]);

        const chain = generator.decompose(step);
        expect(chain.passCount).toBe(chain.passes.length);
      }
    });
  });
});
