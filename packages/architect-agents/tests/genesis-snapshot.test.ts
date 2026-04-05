import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OfflinePromptGenerator } from '../src/core/agent-runtime/offline-prompt-generator.js';
import { RefactoringPlan } from '@girardelli/architect-core/src/core/types/rules.js';

// ── Helpers ──────────────────────────────────────────────────────────

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-snap-'));
}

/**
 * Deterministic timestamp for snapshot stability.
 */
const FIXED_TIMESTAMP = '2025-01-01T00:00:00.000Z';

// ── Fixture Plans ────────────────────────────────────────────────────

function typescriptHubSplitPlan(): RefactoringPlan {
  return {
    timestamp: FIXED_TIMESTAMP,
    projectPath: '/mock/ts-express-api',
    currentScore: {
      overall: 68,
      components: [],
      breakdown: { modularity: 65, coupling: 60, cohesion: 75, layering: 72 },
    },
    estimatedScoreAfter: {
      overall: 82,
      breakdown: { modularity: 80, coupling: 78, cohesion: 82, layering: 80 },
    },
    steps: [
      {
        id: 1,
        tier: 1,
        rule: 'hub-splitter',
        priority: 'CRITICAL',
        title: 'Split hub file: database.ts',
        description: 'database.ts has 12 incoming connections.',
        rationale: 'High fan-in creates coupling bottleneck.',
        operations: [
          {
            type: 'CREATE',
            path: 'src/core/database_query.ts',
            description: 'Create query utilities split',
            content: [
              '// database_query.ts — Query utilities extracted from database.ts',
              'import { Pool } from "pg";',
              '',
              'export class QueryBuilder {',
              '  constructor(private pool: Pool) {}',
              '  async select(table: string, where: Record<string, unknown>) {',
              '    // query logic',
              '  }',
              '}',
            ].join('\n'),
          },
          {
            type: 'CREATE',
            path: 'src/core/database_connection.ts',
            description: 'Create connection pool management',
            content: [
              '// database_connection.ts — Connection pool management',
              'import { Pool, PoolConfig } from "pg";',
              '',
              'export function createPool(config: PoolConfig): Pool {',
              '  return new Pool(config);',
              '}',
            ].join('\n'),
          },
          {
            type: 'MODIFY',
            path: 'src/core/database.ts',
            description: 'Refactor original to delegate to new split modules',
          },
          {
            type: 'MODIFY',
            path: 'src/repos/user.repo.ts',
            description: 'Update imports to use database_query',
          },
          {
            type: 'MODIFY',
            path: 'src/repos/order.repo.ts',
            description: 'Update imports to use database_query',
          },
        ],
        scoreImpact: [
          { metric: 'coupling', before: 60, after: 78 },
        ],
        aiPrompt: 'Split database.ts into database_query.ts and database_connection.ts. Update all 12 dependent files.',
      },
    ],
    totalOperations: 5,
    tier1Steps: 1,
    tier2Steps: 0,
  };
}

function pythonBarrelPlan(): RefactoringPlan {
  return {
    timestamp: FIXED_TIMESTAMP,
    projectPath: '/mock/flask-api',
    currentScore: {
      overall: 72,
      components: [],
      breakdown: { modularity: 70, coupling: 68, cohesion: 78, layering: 72 },
    },
    estimatedScoreAfter: {
      overall: 85,
      breakdown: { modularity: 82, coupling: 80, cohesion: 85, layering: 80 },
    },
    steps: [
      {
        id: 1,
        tier: 1,
        rule: 'barrel-optimizer',
        priority: 'HIGH',
        title: 'Optimize barrel: app/core/__init__.py',
        description: '__init__.py re-exports 8 modules, only 2 are used per consumer.',
        rationale: 'Barrel files create unnecessary dependency chains.',
        operations: [
          {
            type: 'MODIFY',
            path: 'app/routes/api.py',
            description: 'Replace barrel import with direct imports',
          },
          {
            type: 'MODIFY',
            path: 'app/routes/auth.py',
            description: 'Replace barrel import with direct imports',
          },
        ],
        scoreImpact: [
          { metric: 'coupling', before: 68, after: 80 },
        ],
        aiPrompt: 'Replace all imports from app.core with direct module imports.',
      },
      {
        id: 2,
        tier: 1,
        rule: 'import-organizer',
        priority: 'MEDIUM',
        title: 'Create facade for orchestrator.py',
        description: 'orchestrator.py imports from 7 different directories.',
        rationale: 'Cross-boundary imports indicate SRP violation.',
        operations: [
          {
            type: 'CREATE',
            path: 'app/orchestrator_deps.py',
            description: 'Create dependency facade',
            content: [
              '"""',
              'Dependency facade for orchestrator.py',
              'Consolidates cross-boundary imports into a single entry point.',
              '"""',
              'from app.auth.login import LoginService',
              'from app.db.repo import UserRepository',
              'from app.cache.redis import CacheClient',
            ].join('\n'),
          },
          {
            type: 'MODIFY',
            path: 'app/orchestrator.py',
            description: 'Refactor to use facade instead of scattered imports',
          },
        ],
        scoreImpact: [
          { metric: 'modularity', before: 70, after: 82 },
        ],
        aiPrompt: 'Create a dependency facade for orchestrator.py.',
      },
    ],
    totalOperations: 4,
    tier1Steps: 2,
    tier2Steps: 0,
  };
}

function multiStepGoRefactorPlan(): RefactoringPlan {
  return {
    timestamp: FIXED_TIMESTAMP,
    projectPath: '/mock/go-microservice',
    currentScore: {
      overall: 60,
      components: [],
      breakdown: { modularity: 55, coupling: 58, cohesion: 65, layering: 62 },
    },
    estimatedScoreAfter: {
      overall: 78,
      breakdown: { modularity: 75, coupling: 76, cohesion: 80, layering: 78 },
    },
    steps: [
      {
        id: 1,
        tier: 1,
        rule: 'hub-splitter',
        priority: 'CRITICAL',
        title: 'Split hub: handler.go',
        description: 'handler.go has 10 incoming connections.',
        rationale: 'Central handler creates coupling bottleneck.',
        operations: [
          {
            type: 'CREATE',
            path: 'internal/handler/user_handler.go',
            description: 'Extract user-specific handlers',
            content: 'package handler\n\n// UserHandler handles user-related HTTP endpoints.\ntype UserHandler struct{}\n',
          },
          {
            type: 'CREATE',
            path: 'internal/handler/health_handler.go',
            description: 'Extract health check handler',
            content: 'package handler\n\n// HealthHandler handles health check endpoints.\ntype HealthHandler struct{}\n',
          },
          {
            type: 'MODIFY',
            path: 'internal/handler/handler.go',
            description: 'Refactor to delegate to split handler modules',
          },
        ],
        scoreImpact: [{ metric: 'coupling', before: 58, after: 76 }],
        aiPrompt: 'Split handler.go into user_handler.go and health_handler.go.',
      },
      {
        id: 2,
        tier: 1,
        rule: 'dead-code-detector',
        priority: 'LOW',
        title: 'Remove dead code: legacy_migration.go',
        description: 'legacy_migration.go has zero incoming dependencies.',
        rationale: 'Orphan files increase maintenance cost.',
        operations: [
          {
            type: 'DELETE',
            path: 'internal/legacy_migration.go',
            description: 'Remove orphan file after verifying no references',
          },
        ],
        scoreImpact: [{ metric: 'modularity', before: 55, after: 60 }],
        aiPrompt: 'Verify and remove legacy_migration.go if truly unused.',
      },
      {
        id: 3,
        tier: 1,
        rule: 'module-grouper',
        priority: 'MEDIUM',
        title: 'Group co-imported modules into internal/auth/',
        description: 'auth_token.go and auth_middleware.go are always imported together.',
        rationale: 'Co-imported files from different directories should be co-located.',
        operations: [
          {
            type: 'MOVE',
            path: 'pkg/auth_token.go',
            description: 'Move to internal/auth/token.go',
          },
          {
            type: 'MOVE',
            path: 'pkg/auth_middleware.go',
            description: 'Move to internal/auth/middleware.go',
          },
          {
            type: 'MODIFY',
            path: 'internal/handler/user_handler.go',
            description: 'Update imports to use new auth package path',
          },
          {
            type: 'MODIFY',
            path: 'internal/handler/health_handler.go',
            description: 'Update imports to use new auth package path',
          },
        ],
        scoreImpact: [{ metric: 'cohesion', before: 65, after: 80 }],
        aiPrompt: 'Move auth_token.go and auth_middleware.go into a new internal/auth/ package.',
      },
    ],
    totalOperations: 9,
    tier1Steps: 3,
    tier2Steps: 0,
  };
}

// ══════════════════════════════════════════════════════════════════════
// SNAPSHOT TESTS — Genesis Output Stability
// ══════════════════════════════════════════════════════════════════════

describe('Genesis Snapshot Tests', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = createTempDir();
  });

  afterEach(() => {
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  describe('TypeScript hub-split plan', () => {
    it('should produce stable index file', () => {
      const plan = typescriptHubSplitPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      const index = fs.readFileSync(path.join(outputDir, '00-index.md'), 'utf8');
      expect(index).toMatchSnapshot();
    });

    it('should produce stable multi-pass prompts for hub-splitter', () => {
      const plan = typescriptHubSplitPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      // hub-splitter → 3 passes
      const pass1 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-1.md'), 'utf8');
      const pass2 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-2.md'), 'utf8');
      const pass3 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-3.md'), 'utf8');
      expect(pass1).toMatchSnapshot('hub-splitter-pass-1');
      expect(pass2).toMatchSnapshot('hub-splitter-pass-2');
      expect(pass3).toMatchSnapshot('hub-splitter-pass-3');
    });
  });

  describe('Python barrel + import-organizer plan', () => {
    it('should produce stable index for multi-rule plan', () => {
      const plan = pythonBarrelPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      const index = fs.readFileSync(path.join(outputDir, '00-index.md'), 'utf8');
      expect(index).toMatchSnapshot();
    });

    it('should produce stable multi-pass prompts for barrel-optimizer', () => {
      const plan = pythonBarrelPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      // barrel-optimizer → 2 passes
      const pass1 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-1.md'), 'utf8');
      const pass2 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-2.md'), 'utf8');
      expect(pass1).toMatchSnapshot('barrel-optimizer-pass-1');
      expect(pass2).toMatchSnapshot('barrel-optimizer-pass-2');
    });

    it('should produce stable multi-pass prompts for import-organizer', () => {
      const plan = pythonBarrelPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      // import-organizer → 2 passes
      const pass1 = fs.readFileSync(path.join(outputDir, '02-step-2-pass-1.md'), 'utf8');
      const pass2 = fs.readFileSync(path.join(outputDir, '02-step-2-pass-2.md'), 'utf8');
      expect(pass1).toMatchSnapshot('import-organizer-pass-1');
      expect(pass2).toMatchSnapshot('import-organizer-pass-2');
    });
  });

  describe('Go multi-step refactor plan', () => {
    it('should produce stable index for 3-step plan', () => {
      const plan = multiStepGoRefactorPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      const index = fs.readFileSync(path.join(outputDir, '00-index.md'), 'utf8');
      expect(index).toMatchSnapshot();
    });

    it('should produce stable multi-pass hub-splitter step', () => {
      const plan = multiStepGoRefactorPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      // hub-splitter → 3 passes
      const pass1 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-1.md'), 'utf8');
      expect(pass1).toMatchSnapshot('go-hub-splitter-pass-1');
    });

    it('should produce stable step-2 (dead-code DELETE op — single pass)', () => {
      const plan = multiStepGoRefactorPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      // dead-code-detector → 1 pass → single file
      const step = fs.readFileSync(path.join(outputDir, '02-step-2.md'), 'utf8');
      expect(step).toMatchSnapshot();
    });

    it('should produce stable step-3 (module-grouper — 3 passes)', () => {
      const plan = multiStepGoRefactorPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      // module-grouper → 3 passes
      const pass1 = fs.readFileSync(path.join(outputDir, '03-step-3-pass-1.md'), 'utf8');
      expect(pass1).toMatchSnapshot('module-grouper-pass-1');
    });
  });

  describe('budget variation stability', () => {
    it('should produce stable output with qwen-32b budget (small context)', () => {
      const plan = typescriptHubSplitPlan();
      const gen = new OfflinePromptGenerator({
        maxTokensPerPrompt: 8_000,
        maxFullFileInlines: 3,
        maxLinesPerFile: 150,
      });
      gen.generate(plan, outputDir);

      // hub-splitter → multi-pass; budget applies to single-pass steps
      const pass1 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-1.md'), 'utf8');
      expect(pass1).toMatchSnapshot();
    });

    it('should produce stable output with large budget (100K tokens)', () => {
      const plan = typescriptHubSplitPlan();
      const gen = new OfflinePromptGenerator({
        maxTokensPerPrompt: 100_000,
        maxFullFileInlines: 20,
        maxLinesPerFile: 500,
      });
      gen.generate(plan, outputDir);

      const pass1 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-1.md'), 'utf8');
      expect(pass1).toMatchSnapshot();
    });
  });

  describe('structural invariants', () => {
    it('every generated prompt file should contain Response Format directive', () => {
      const plan = multiStepGoRefactorPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      const files = fs.readdirSync(outputDir).filter(f => f !== '00-index.md');
      expect(files.length).toBeGreaterThan(0);

      for (const file of files) {
        const content = fs.readFileSync(path.join(outputDir, file), 'utf8');
        expect(content).toContain('Response Format');
      }
    });

    it('index should list all steps for any plan size', () => {
      const plan = multiStepGoRefactorPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      const index = fs.readFileSync(path.join(outputDir, '00-index.md'), 'utf8');
      for (const step of plan.steps) {
        expect(index).toContain(`Step #${step.id}`);
      }
    });

    it('multi-pass hub-splitter should handle consumer updates in pass 3', () => {
      const plan = typescriptHubSplitPlan();
      const gen = new OfflinePromptGenerator();
      gen.generate(plan, outputDir);

      // Hub-splitter pass 3 is "Update all consumer imports"
      const pass3 = fs.readFileSync(path.join(outputDir, '01-step-1-pass-3.md'), 'utf8');
      expect(pass3).toContain('consumer');
      expect(pass3).toContain('user.repo.ts');
      expect(pass3).toContain('order.repo.ts');
    });

    it('zero-stdlib references in generated prompts', () => {
      const plans = [typescriptHubSplitPlan(), pythonBarrelPlan(), multiStepGoRefactorPlan()];
      const stdlibPatterns = [
        /\bimport .+ from ['"]fs['"]/,
        /\bimport .+ from ['"]path['"]/,
        /\bimport .+ from ['"]os['"]/,
        /\bimport .+ from ['"]sys['"]/,
        /\brequire\(['"]crypto['"]\)/,
      ];

      for (const plan of plans) {
        const dir = createTempDir();
        try {
          const gen = new OfflinePromptGenerator();
          gen.generate(plan, dir);

          const files = fs.readdirSync(dir);
          for (const file of files) {
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            for (const pattern of stdlibPatterns) {
              // Only check non-content sections (the inline code blocks contain user code)
              const nonCodeSections = content.replace(/```[\s\S]*?```/g, '');
              expect(nonCodeSections).not.toMatch(pattern);
            }
          }
        } finally {
          try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
        }
      }
    });
  });
});
