import { RefactorEngine } from '../src/core/refactor-engine.js';
import { buildDependencyIndex, DependencyIndex, DependencyEdge } from '../src/core/types/core.js';
import { RefactorStep, FileOperation } from '../src/core/types/rules.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeStep(id: number, ops: FileOperation[]): RefactorStep {
  return {
    id,
    tier: 1,
    rule: 'hub-splitter',
    priority: 'HIGH',
    title: `Step ${id}`,
    description: `Description for step ${id}`,
    rationale: 'Test rationale',
    operations: ops,
    scoreImpact: [{ metric: 'coupling', before: 60, after: 75 }],
  };
}

function op(type: FileOperation['type'], path: string, extra?: Partial<FileOperation>): FileOperation {
  return { type, path, description: `${type} ${path}`, ...extra };
}

function makeIndex(edges: DependencyEdge[]): DependencyIndex {
  return buildDependencyIndex(edges);
}

function edge(from: string, to: string): DependencyEdge {
  return { from, to, type: 'import', weight: 1 };
}

// ── Tests ────────────────────────────────────────────────────────

describe('RefactorEngine.computeAffectedScope', () => {
  let engine: RefactorEngine;

  beforeEach(() => {
    engine = new RefactorEngine();
  });

  it('should return changed files from step operations', () => {
    const step = makeStep(1, [
      op('MODIFY', 'src/hub.ts'),
      op('CREATE', 'src/extracted-a.ts'),
    ]);

    const index = makeIndex([]);
    const scope = engine.computeAffectedScope(step, index);

    expect(scope.changedFiles).toContain('src/hub.ts');
    expect(scope.changedFiles).toContain('src/extracted-a.ts');
    expect(scope.changedFiles).toHaveLength(2);
    expect(scope.consumerFiles).toHaveLength(0);
  });

  it('should include newPath in changed files for MOVE operations', () => {
    const step = makeStep(1, [
      op('MOVE', 'src/old.ts', { newPath: 'src/modules/new.ts' }),
    ]);

    const index = makeIndex([]);
    const scope = engine.computeAffectedScope(step, index);

    expect(scope.changedFiles).toContain('src/old.ts');
    expect(scope.changedFiles).toContain('src/modules/new.ts');
    expect(scope.changedFiles).toHaveLength(2);
  });

  it('should find consumer files that import changed files', () => {
    const step = makeStep(1, [
      op('MODIFY', 'src/hub.ts'),
    ]);

    const index = makeIndex([
      edge('src/app.ts', 'src/hub.ts'),
      edge('src/service.ts', 'src/hub.ts'),
      edge('src/hub.ts', 'src/utils.ts'), // outgoing — NOT a consumer
    ]);

    const scope = engine.computeAffectedScope(step, index);

    expect(scope.changedFiles).toEqual(['src/hub.ts']);
    expect(scope.consumerFiles).toContain('src/app.ts');
    expect(scope.consumerFiles).toContain('src/service.ts');
    expect(scope.consumerFiles).toHaveLength(2);
  });

  it('should NOT include changed files as consumers', () => {
    const step = makeStep(1, [
      op('MODIFY', 'src/a.ts'),
      op('MODIFY', 'src/b.ts'),
    ]);

    const index = makeIndex([
      edge('src/a.ts', 'src/b.ts'),
      edge('src/b.ts', 'src/a.ts'),
      edge('src/c.ts', 'src/a.ts'),
    ]);

    const scope = engine.computeAffectedScope(step, index);

    expect(scope.changedFiles).toEqual(expect.arrayContaining(['src/a.ts', 'src/b.ts']));
    // a and b import each other but they are changed files, not consumers
    expect(scope.consumerFiles).toEqual(['src/c.ts']);
  });

  it('should handle empty operations', () => {
    const step = makeStep(1, []);
    const index = makeIndex([]);
    const scope = engine.computeAffectedScope(step, index);

    expect(scope.changedFiles).toHaveLength(0);
    expect(scope.consumerFiles).toHaveLength(0);
  });

  it('should handle DELETE operations', () => {
    const step = makeStep(1, [
      op('DELETE', 'src/dead.ts'),
    ]);

    const index = makeIndex([
      edge('src/legacy.ts', 'src/dead.ts'),
    ]);

    const scope = engine.computeAffectedScope(step, index);

    expect(scope.changedFiles).toEqual(['src/dead.ts']);
    expect(scope.consumerFiles).toEqual(['src/legacy.ts']);
  });

  it('should deduplicate files across multiple operations', () => {
    const step = makeStep(1, [
      op('CREATE', 'src/new.ts'),
      op('MODIFY', 'src/new.ts'), // same file, different op
    ]);

    const index = makeIndex([]);
    const scope = engine.computeAffectedScope(step, index);

    expect(scope.changedFiles).toEqual(['src/new.ts']);
  });

  it('should handle complex multi-op step (hub-splitter pattern)', () => {
    const step = makeStep(1, [
      op('CREATE', 'src/auth/login.ts'),
      op('CREATE', 'src/auth/register.ts'),
      op('MODIFY', 'src/hub.ts'),
      op('MODIFY', 'src/app.ts'),
    ]);

    const index = makeIndex([
      edge('src/app.ts', 'src/hub.ts'),
      edge('src/routes.ts', 'src/hub.ts'),
      edge('src/middleware.ts', 'src/hub.ts'),
      edge('src/test.ts', 'src/app.ts'),
    ]);

    const scope = engine.computeAffectedScope(step, index);

    expect(scope.changedFiles).toHaveLength(4);
    // routes.ts and middleware.ts import hub.ts (changed), and test.ts imports app.ts (changed)
    expect(scope.consumerFiles).toContain('src/routes.ts');
    expect(scope.consumerFiles).toContain('src/middleware.ts');
    expect(scope.consumerFiles).toContain('src/test.ts');
    expect(scope.consumerFiles).toHaveLength(3);
  });
});
