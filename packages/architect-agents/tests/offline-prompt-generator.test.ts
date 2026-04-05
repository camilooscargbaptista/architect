import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OfflinePromptGenerator } from '../src/core/agent-runtime/offline-prompt-generator.js';
import {
  estimateTokens,
  classifyOperation,
  abbreviateFileContent,
  resolveBudget,
  DEFAULT_BUDGET,
} from '../src/core/agent-runtime/prompt-budget.js';
import { RefactoringPlan } from '@girardelli/architect-core/src/core/types/rules.js';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockPlan(stepCount: number = 2): RefactoringPlan {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    id: i + 1,
    tier: 1 as const,
    rule: 'hub-splitter',
    priority: 'HIGH' as const,
    title: `Split hub file: service${i}.ts`,
    description: `service${i}.ts has 10 incoming connections.`,
    rationale: 'High fan-in creates bottleneck.',
    operations: [
      {
        type: 'CREATE' as const,
        path: `src/core/service${i}_auth.ts`,
        description: 'Create auth split',
        content: `// service${i}_auth.ts\nexport class Auth${i}Service {}\n`,
      },
      {
        type: 'MODIFY' as const,
        path: `src/core/service${i}.ts`,
        description: 'Refactor original to extract grouped functionality',
      },
      {
        type: 'MODIFY' as const,
        path: `src/consumers/consumer${i}.ts`,
        description: 'Update imports to use new split modules',
      },
    ],
    scoreImpact: [{ metric: 'coupling', before: 65, after: 80 }],
    aiPrompt: `Split service${i}.ts into focused modules.`,
  }));

  return {
    timestamp: new Date().toISOString(),
    projectPath: '/mock/project',
    currentScore: {
      overall: 70,
      components: [],
      breakdown: { modularity: 70, coupling: 65, cohesion: 75, layering: 70 },
    },
    estimatedScoreAfter: { overall: 82, breakdown: { modularity: 80, coupling: 80, cohesion: 80, layering: 80 } },
    steps,
    totalOperations: steps.reduce((sum, s) => sum + s.operations.length, 0),
    tier1Steps: steps.length,
    tier2Steps: 0,
  };
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'genesis-test-'));
}

// ══════════════════════════════════════════════════════════════════════
// PROMPT BUDGET UNIT TESTS
// ══════════════════════════════════════════════════════════════════════

describe('PromptBudget', () => {
  describe('estimateTokens', () => {
    it('should estimate ~4 chars per token', () => {
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('a'.repeat(400))).toBe(100);
    });

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });
  });

  describe('classifyOperation', () => {
    it('should classify CREATE as core-target', () => {
      expect(classifyOperation({ type: 'CREATE' })).toBe('core-target');
    });

    it('should classify SPLIT as core-target', () => {
      expect(classifyOperation({ type: 'SPLIT' })).toBe('core-target');
    });

    it('should classify DELETE as consumer-ref', () => {
      expect(classifyOperation({ type: 'DELETE' })).toBe('consumer-ref');
    });

    it('should classify MODIFY with "update import" as consumer-ref', () => {
      expect(classifyOperation({ type: 'MODIFY', description: 'Update imports in consumer.ts' })).toBe('consumer-ref');
    });

    it('should classify MODIFY with "replace barrel import" as consumer-ref', () => {
      expect(classifyOperation({ type: 'MODIFY', description: 'Replace barrel import from index.ts' })).toBe('consumer-ref');
    });

    it('should classify MODIFY with refactoring description as important-context', () => {
      expect(classifyOperation({ type: 'MODIFY', description: 'Refactor to extract auth logic' })).toBe('important-context');
    });
  });

  describe('abbreviateFileContent', () => {
    it('should return full content for files <= 40 lines', () => {
      const content = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n');
      expect(abbreviateFileContent(content, 'ts')).toBe(content);
    });

    it('should abbreviate files > 40 lines', () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
      const abbreviated = abbreviateFileContent(content, 'ts');
      expect(abbreviated).toContain('lines omitted');
      expect(abbreviated.split('\n').length).toBeLessThan(100);
    });

    it('should include exported interface section', () => {
      const lines = [
        ...Array.from({ length: 30 }, (_, i) => `import { thing${i} } from './dep.js';`),
        'export function doSomething() {}',
        'export class MyService {}',
        ...Array.from({ length: 20 }, () => '  // implementation'),
      ];
      const abbreviated = abbreviateFileContent(lines.join('\n'), 'ts');
      expect(abbreviated).toContain('Exported Interface');
      expect(abbreviated).toContain('export function doSomething');
    });

    it('should use # comment for Python files', () => {
      const content = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
      const abbreviated = abbreviateFileContent(content, 'py');
      expect(abbreviated).toContain('# ...');
    });
  });

  describe('resolveBudget', () => {
    it('should return defaults when no config provided', () => {
      expect(resolveBudget()).toEqual(DEFAULT_BUDGET);
      expect(resolveBudget(undefined)).toEqual(DEFAULT_BUDGET);
    });

    it('should apply model preset for claude-3', () => {
      const budget = resolveBudget({ targetModel: 'claude-3' });
      expect(budget.maxTokensPerPrompt).toBe(60_000);
      expect(budget.maxFullFileInlines).toBe(10);
    });

    it('should apply model preset for qwen-32b', () => {
      const budget = resolveBudget({ targetModel: 'qwen-32b' });
      expect(budget.maxTokensPerPrompt).toBe(8_000);
      expect(budget.maxFullFileInlines).toBe(3);
      expect(budget.maxLinesPerFile).toBe(150);
    });

    it('should use customTokenLimit for custom model', () => {
      const budget = resolveBudget({ targetModel: 'custom', customTokenLimit: 50_000 });
      expect(budget.maxTokensPerPrompt).toBe(50_000);
    });

    it('should override preset with explicit values', () => {
      const budget = resolveBudget({
        targetModel: 'claude-3',
        maxTokensPerPrompt: 10_000,  // Override the 60K preset
      });
      expect(budget.maxTokensPerPrompt).toBe(10_000);
      expect(budget.maxFullFileInlines).toBe(10);  // From preset
    });
  });
});

// ══════════════════════════════════════════════════════════════════════
// OFFLINE PROMPT GENERATOR TESTS
// ══════════════════════════════════════════════════════════════════════

describe('OfflinePromptGenerator', () => {
  let outputDir: string;

  beforeEach(() => {
    outputDir = createTempDir();
  });

  afterEach(() => {
    // Cleanup
    try {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('file generation', () => {
    it('should generate index file and multi-pass step files for hub-splitter', () => {
      const plan = createMockPlan(2);
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      expect(fs.existsSync(path.join(outputDir, '00-index.md'))).toBe(true);
      // hub-splitter → 3 passes per step
      expect(fs.existsSync(path.join(outputDir, '01-step-1-pass-1.md'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, '01-step-1-pass-2.md'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, '01-step-1-pass-3.md'))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, '02-step-2-pass-1.md'))).toBe(true);
    });

    it('should generate single file for unknown rule (backward compat)', () => {
      const plan: RefactoringPlan = {
        ...createMockPlan(1),
        steps: [{
          id: 1, tier: 1, rule: 'custom-rule', priority: 'HIGH',
          title: 'Custom step', description: 'desc', rationale: 'reason',
          operations: [{ type: 'MODIFY', path: 'src/app.ts', description: 'Refactor app' }],
          scoreImpact: [],
          aiPrompt: 'Do the thing',
        }],
      };
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      // Unknown rule → 1 pass → single file (backward compat)
      expect(fs.existsSync(path.join(outputDir, '01-step-1.md'))).toBe(true);
    });

    it('should include step listing in index file', () => {
      const plan = createMockPlan(2);
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      const index = fs.readFileSync(path.join(outputDir, '00-index.md'), 'utf8');
      expect(index).toContain('Step #1');
      expect(index).toContain('Step #2');
      expect(index).toContain('Total Steps:** 2');
    });

    it('should show multi-pass structure in index', () => {
      const plan = createMockPlan(1);
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      const index = fs.readFileSync(path.join(outputDir, '00-index.md'), 'utf8');
      expect(index).toContain('3 passes');
      expect(index).toContain('Pass 1');
      expect(index).toContain('Pass 2');
      expect(index).toContain('Pass 3');
      expect(index).toContain('Multi-Pass');
    });
  });

  describe('response format directive', () => {
    it('should include response format instructions in multi-pass prompts', () => {
      const plan = createMockPlan(1);
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      // hub-splitter generates 3 passes — check each has the directive
      for (let p = 1; p <= 3; p++) {
        const pass = fs.readFileSync(path.join(outputDir, `01-step-1-pass-${p}.md`), 'utf8');
        expect(pass).toContain('Response Format');
      }
    });

    it('should include response format in single-pass prompts', () => {
      const plan: RefactoringPlan = {
        ...createMockPlan(1),
        steps: [{
          id: 1, tier: 1, rule: 'custom-rule', priority: 'HIGH',
          title: 'Custom', description: 'desc', rationale: 'reason',
          operations: [{ type: 'MODIFY', path: 'src/app.ts', description: 'Refactor' }],
          scoreImpact: [],
          aiPrompt: 'Do the thing',
        }],
      };
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      const step = fs.readFileSync(path.join(outputDir, '01-step-1.md'), 'utf8');
      expect(step).toContain('Response Format');
      expect(step).toContain('COMPLETE file content');
    });
  });

  describe('consumer follow-up block', () => {
    it('should generate follow-up block for single-pass steps with consumer ops', () => {
      // Use a rule that produces single-pass (dead-code-detector or custom)
      const plan: RefactoringPlan = {
        ...createMockPlan(1),
        steps: [{
          id: 1, tier: 1, rule: 'custom-rule', priority: 'HIGH',
          title: 'Custom refactor', description: 'desc', rationale: 'reason',
          operations: [
            { type: 'MODIFY', path: 'src/core/service.ts', description: 'Refactor service.ts' },
            { type: 'MODIFY', path: 'src/consumers/consumer0.ts', description: 'Update imports to use new modules' },
          ],
          scoreImpact: [],
          aiPrompt: 'Split service into modules.',
        }],
      };
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      const step = fs.readFileSync(path.join(outputDir, '01-step-1.md'), 'utf8');
      expect(step).toContain('Manual Follow-up Required');
      expect(step).toContain('consumer0.ts');
    });

    it('should NOT generate follow-up block when all ops are core-target', () => {
      const plan: RefactoringPlan = {
        ...createMockPlan(1),
        steps: [{
          id: 1, tier: 1, rule: 'custom-rule', priority: 'HIGH',
          title: 'Create module', description: 'desc', rationale: 'reason',
          operations: [
            { type: 'CREATE', path: 'src/new.ts', description: 'Create new', content: '// new' },
          ],
          scoreImpact: [],
          aiPrompt: 'Create new module.',
        }],
      };

      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      const step = fs.readFileSync(path.join(outputDir, '01-step-1.md'), 'utf8');
      expect(step).not.toContain('Manual Follow-up Required');
    });
  });

  describe('budget configuration', () => {
    it('should include budget info in index', () => {
      const generator = new OfflinePromptGenerator({ maxTokensPerPrompt: 50_000 });
      const plan = createMockPlan(1);
      generator.generate(plan, outputDir);

      const index = fs.readFileSync(path.join(outputDir, '00-index.md'), 'utf8');
      expect(index).toContain('50,000');
    });
  });

  describe('edge cases', () => {
    it('should handle plan with zero steps', () => {
      const plan = createMockPlan(0);
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, outputDir);

      expect(fs.existsSync(path.join(outputDir, '00-index.md'))).toBe(true);
      // Only index, no step files
      const files = fs.readdirSync(outputDir);
      expect(files).toHaveLength(1);
    });

    it('should create output directory if it does not exist', () => {
      const nested = path.join(outputDir, 'deep', 'nested', 'dir');
      const plan = createMockPlan(1);
      const generator = new OfflinePromptGenerator();
      generator.generate(plan, nested);

      expect(fs.existsSync(path.join(nested, '00-index.md'))).toBe(true);
    });

    it('should handle missing source files gracefully', () => {
      const plan = createMockPlan(1);
      const generator = new OfflinePromptGenerator();
      // Generate will try to read files that don't exist — should not throw
      expect(() => generator.generate(plan, outputDir)).not.toThrow();
    });
  });
});
