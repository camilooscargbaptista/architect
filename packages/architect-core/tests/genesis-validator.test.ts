import { GenesisValidator } from '../src/core/genesis-validator.js';
import { RefactoringPlan, RefactorStep, FileOperation } from '../src/core/types/rules.js';

// ── Helpers ──────────────────────────────────────────────────────

function makePlan(steps: RefactorStep[]): RefactoringPlan {
  return {
    timestamp: new Date().toISOString(),
    projectPath: '/project',
    currentScore: { overall: 60, components: [], breakdown: { modularity: 60, coupling: 60, cohesion: 60, layering: 60 } },
    estimatedScoreAfter: { overall: 75, breakdown: { modularity: 75, coupling: 75, cohesion: 75, layering: 75 } },
    steps,
    totalOperations: steps.reduce((s, st) => s + st.operations.length, 0),
    tier1Steps: steps.length,
    tier2Steps: 0,
  };
}

function makeStep(id: number, ops: FileOperation[], overrides?: Partial<RefactorStep>): RefactorStep {
  return {
    id,
    tier: 1,
    rule: overrides?.rule ?? 'test-rule',
    priority: 'MEDIUM',
    title: `Step ${id}`,
    description: `Description for step ${id}`,
    rationale: 'Test rationale',
    operations: ops,
    scoreImpact: [{ metric: 'coupling', before: 60, after: 75 }],
    ...overrides,
  };
}

function op(type: FileOperation['type'], path: string, extra?: Partial<FileOperation>): FileOperation {
  return { type, path, description: `${type} ${path}`, ...extra };
}

// ── Tests ────────────────────────────────────────────────────────

describe('GenesisValidator', () => {
  let validator: GenesisValidator;

  beforeEach(() => {
    validator = new GenesisValidator();
  });

  describe('valid plans', () => {
    it('should pass a well-formed plan with no issues', () => {
      const plan = makePlan([
        makeStep(1, [
          op('CREATE', 'src/utils_auth.ts'),
          op('CREATE', 'src/utils_api.ts'),
          op('MODIFY', 'src/utils.ts', { description: 'Refactor — extract grouped functionality' }),
          op('MODIFY', 'src/app.ts', { description: 'Update imports in app.ts to use new split modules' }),
        ], { rule: 'hub-splitter' }),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should pass an empty plan', () => {
      const plan = makePlan([]);
      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('Pass 1: Circular operation detection', () => {
    it('should detect MODIFY before CREATE in step order', () => {
      const plan = makePlan([
        makeStep(1, [op('MODIFY', 'src/new-module.ts')]),
        makeStep(2, [op('CREATE', 'src/new-module.ts')]),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.category).toBe('CIRCULAR_OPERATION');
      expect(result.issues[0]!.severity).toBe('ERROR');
      expect(result.issues[0]!.message).toContain('Step 1');
      expect(result.issues[0]!.message).toContain('Step 2');
    });

    it('should detect DELETE before CREATE in step order', () => {
      const plan = makePlan([
        makeStep(1, [op('DELETE', 'src/module.ts')]),
        makeStep(2, [op('CREATE', 'src/module.ts')]),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.category === 'CIRCULAR_OPERATION')).toBe(true);
    });

    it('should detect same-step CREATE+DELETE contradiction', () => {
      const plan = makePlan([
        makeStep(1, [
          op('CREATE', 'src/module.ts'),
          op('DELETE', 'src/module.ts'),
        ]),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.issues[0]!.category).toBe('CIRCULAR_OPERATION');
      expect(result.issues[0]!.message).toContain('CREATEs and DELETEs');
    });

    it('should NOT flag CREATE then MODIFY in correct order', () => {
      const plan = makePlan([
        makeStep(1, [op('CREATE', 'src/module.ts')]),
        makeStep(2, [op('MODIFY', 'src/module.ts')]),
      ]);

      const result = validator.validate(plan);
      const circularIssues = result.issues.filter(i => i.category === 'CIRCULAR_OPERATION');
      expect(circularIssues).toHaveLength(0);
    });
  });

  describe('Pass 2: Orphan import detection', () => {
    it('should warn when MOVE has no consumer MODIFY', () => {
      const plan = makePlan([
        makeStep(1, [
          op('MOVE', 'src/old.ts', { newPath: 'src/utils/old.ts' }),
        ]),
      ]);

      const result = validator.validate(plan);
      expect(result.issues.some(i => i.category === 'ORPHAN_IMPORT')).toBe(true);
    });

    it('should NOT warn when MOVE has consumer import update', () => {
      const plan = makePlan([
        makeStep(1, [
          op('MOVE', 'src/old.ts', { newPath: 'src/utils/old.ts' }),
          op('MODIFY', 'src/app.ts', { description: 'Update imports for old.ts' }),
        ]),
      ]);

      const result = validator.validate(plan);
      const orphanIssues = result.issues.filter(i => i.category === 'ORPHAN_IMPORT');
      expect(orphanIssues).toHaveLength(0);
    });

    it('should accept cross-step consumer updates', () => {
      const plan = makePlan([
        makeStep(1, [op('MOVE', 'src/old.ts', { newPath: 'src/utils/old.ts' })]),
        makeStep(2, [op('MODIFY', 'src/app.ts', { description: 'Update import for old.ts' })]),
      ]);

      const result = validator.validate(plan);
      const orphanIssues = result.issues.filter(i => i.category === 'ORPHAN_IMPORT');
      expect(orphanIssues).toHaveLength(0);
    });
  });

  describe('Pass 3: Incomplete split detection', () => {
    it('should ERROR when hub-splitter CREATEs without MODIFY', () => {
      const plan = makePlan([
        makeStep(1, [
          op('CREATE', 'src/utils_auth.ts'),
          op('CREATE', 'src/utils_api.ts'),
        ], { rule: 'hub-splitter' }),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.category === 'INCOMPLETE_SPLIT' && i.severity === 'ERROR'
      )).toBe(true);
    });

    it('should WARN when hub-splitter has no original file MODIFY', () => {
      const plan = makePlan([
        makeStep(1, [
          op('CREATE', 'src/core/utils_auth.ts'),
          op('CREATE', 'src/core/utils_api.ts'),
          op('MODIFY', 'src/app.ts', { description: 'Update imports' }),
        ], { rule: 'hub-splitter' }),
      ]);

      const result = validator.validate(plan);
      expect(result.issues.some(i =>
        i.category === 'INCOMPLETE_SPLIT' && i.severity === 'WARNING'
      )).toBe(true);
    });

    it('should NOT flag when hub-splitter has proper MODIFY for original', () => {
      const plan = makePlan([
        makeStep(1, [
          op('CREATE', 'src/core/utils_auth.ts'),
          op('CREATE', 'src/core/utils_api.ts'),
          op('MODIFY', 'src/core/utils.ts', { description: 'Refactor utils.ts — extract grouped functionality' }),
          op('MODIFY', 'src/app.ts', { description: 'Update imports' }),
        ], { rule: 'hub-splitter' }),
      ]);

      const result = validator.validate(plan);
      const splitErrors = result.issues.filter(i =>
        i.category === 'INCOMPLETE_SPLIT' && i.severity === 'ERROR'
      );
      expect(splitErrors).toHaveLength(0);
    });

    it('should NOT flag non-hub-splitter rules', () => {
      const plan = makePlan([
        makeStep(1, [
          op('CREATE', 'src/facade.ts'),
        ], { rule: 'import-organizer' }),
      ]);

      const result = validator.validate(plan);
      const splitIssues = result.issues.filter(i => i.category === 'INCOMPLETE_SPLIT');
      expect(splitIssues).toHaveLength(0);
    });
  });

  describe('Pass 4: Path collision detection', () => {
    it('should ERROR on duplicate CREATE paths across steps', () => {
      const plan = makePlan([
        makeStep(1, [op('CREATE', 'src/shared/index.ts')]),
        makeStep(2, [op('CREATE', 'src/shared/index.ts')]),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.category === 'PATH_COLLISION' && i.message.includes('CREATEd by multiple steps')
      )).toBe(true);
    });

    it('should ERROR on duplicate MOVE destinations', () => {
      const plan = makePlan([
        makeStep(1, [
          op('MOVE', 'src/a.ts', { newPath: 'src/shared/module.ts' }),
          op('MOVE', 'src/b.ts', { newPath: 'src/shared/module.ts' }),
        ]),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.category === 'PATH_COLLISION' && i.message.includes('Multiple files MOVEd')
      )).toBe(true);
    });

    it('should ERROR when CREATE and MOVE target same path', () => {
      const plan = makePlan([
        makeStep(1, [op('CREATE', 'src/shared/index.ts')]),
        makeStep(2, [op('MOVE', 'src/old.ts', { newPath: 'src/shared/index.ts' })]),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i =>
        i.category === 'PATH_COLLISION' && i.message.includes('CREATEd') && i.message.includes('MOVE')
      )).toBe(true);
    });

    it('should NOT flag unique paths', () => {
      const plan = makePlan([
        makeStep(1, [op('CREATE', 'src/a.ts')]),
        makeStep(2, [op('CREATE', 'src/b.ts')]),
      ]);

      const result = validator.validate(plan);
      const collisions = result.issues.filter(i => i.category === 'PATH_COLLISION');
      expect(collisions).toHaveLength(0);
    });
  });

  describe('Pass 5: Scope validation', () => {
    const projectFiles = new Set([
      'src/app.ts',
      'src/utils.ts',
      'src/core/scorer.ts',
    ]);

    it('should WARN when MODIFY targets a non-existent file', () => {
      const plan = makePlan([
        makeStep(1, [op('MODIFY', 'src/nonexistent.ts')]),
      ]);

      const result = validator.validate(plan, projectFiles);
      expect(result.issues.some(i =>
        i.category === 'SCOPE_VIOLATION' && i.message.includes('nonexistent.ts')
      )).toBe(true);
    });

    it('should NOT warn when MODIFY targets a file CREATEd by the plan', () => {
      const plan = makePlan([
        makeStep(1, [op('CREATE', 'src/new-module.ts')]),
        makeStep(2, [op('MODIFY', 'src/new-module.ts')]),
      ]);

      const result = validator.validate(plan, projectFiles);
      const scopeIssues = result.issues.filter(i => i.category === 'SCOPE_VIOLATION');
      expect(scopeIssues).toHaveLength(0);
    });

    it('should NOT warn when MODIFY targets an existing project file', () => {
      const plan = makePlan([
        makeStep(1, [op('MODIFY', 'src/utils.ts')]),
      ]);

      const result = validator.validate(plan, projectFiles);
      const scopeIssues = result.issues.filter(i => i.category === 'SCOPE_VIOLATION');
      expect(scopeIssues).toHaveLength(0);
    });

    it('should skip scope validation when no projectFiles provided', () => {
      const plan = makePlan([
        makeStep(1, [op('MODIFY', 'totally/fake/path.ts')]),
      ]);

      const result = validator.validate(plan);
      const scopeIssues = result.issues.filter(i => i.category === 'SCOPE_VIOLATION');
      expect(scopeIssues).toHaveLength(0);
    });
  });

  describe('Pass 6: Empty step detection', () => {
    it('should WARN on steps with zero operations', () => {
      const plan = makePlan([
        makeStep(1, []),
      ]);

      const result = validator.validate(plan);
      expect(result.issues.some(i =>
        i.category === 'EMPTY_STEP' && i.severity === 'WARNING'
      )).toBe(true);
    });

    it('should NOT warn on steps with operations', () => {
      const plan = makePlan([
        makeStep(1, [op('CREATE', 'src/new.ts')]),
      ]);

      const result = validator.validate(plan);
      const emptyIssues = result.issues.filter(i => i.category === 'EMPTY_STEP');
      expect(emptyIssues).toHaveLength(0);
    });
  });

  describe('aggregation', () => {
    it('should count errors, warnings, and info correctly', () => {
      const plan = makePlan([
        // ERROR: circular op
        makeStep(1, [op('MODIFY', 'src/future.ts')]),
        makeStep(2, [op('CREATE', 'src/future.ts')]),
        // WARNING: empty step
        makeStep(3, []),
        // INFO: orphan DELETE
        makeStep(4, [op('DELETE', 'src/dead.ts')]),
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(false);
      expect(result.errorCount).toBeGreaterThanOrEqual(1);
      expect(result.warningCount).toBeGreaterThanOrEqual(1);
      expect(result.issues.length).toBe(result.errorCount + result.warningCount + result.infoCount);
    });

    it('should return valid: true when only warnings/info', () => {
      const plan = makePlan([
        makeStep(1, []),  // WARNING: empty step
      ]);

      const result = validator.validate(plan);
      expect(result.valid).toBe(true);
      expect(result.warningCount).toBe(1);
    });
  });
});
