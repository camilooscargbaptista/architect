import { jest } from '@jest/globals';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { AgentExecutor } from '../src/core/agent-runtime/executor.js';
import { ModelProviderFactory, AIProvider } from '../src/core/agent-runtime/ai-provider.js';
import { RefactoringPlan } from '../src/core/types/rules.js';

// Mock the AI provider
const mockAIProvider: AIProvider = {
  executeRefactoringPrompt: async (content: string, _prompt: string) => {
    return `// MOCKED AI RESULT\n${content}\n// END MOCK`;
  }
};

describe('Autonomous Agent Runtime', () => {
  const sandboxDir = join(process.cwd(), 'tests', 'sandbox-runtime');

  beforeEach(() => {
    if (existsSync(sandboxDir)) {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
    mkdirSync(sandboxDir, { recursive: true });
    
    // Override the factory to return our mock
    jest.spyOn(ModelProviderFactory, 'createProvider').mockReturnValue(mockAIProvider);
  });

  afterEach(() => {
    if (existsSync(sandboxDir)) {
      rmSync(sandboxDir, { recursive: true, force: true });
    }
    jest.restoreAllMocks();
  });

  it('should deterministically CREATE, MODIFY, and MOVE files', async () => {
    const executor = new AgentExecutor(true); // autoMode = true

    // Setup initial file
    const file1 = join(sandboxDir, 'old-file.ts');
    writeFileSync(file1, 'const a = 1;', 'utf-8');

    const plan: RefactoringPlan = {
      timestamp: new Date().toISOString(),
      projectPath: sandboxDir,
      currentScore: { overall: 50, breakdown: { modularity: 50, coupling: 50, cohesion: 50, layering: 50 }, modularity: { totalComponents: 1, loose: 1, strict: 0 } } as any,
      estimatedScoreAfter: { overall: 60, breakdown: {} },
      totalOperations: 3,
      tier1Steps: 1,
      tier2Steps: 0,
      steps: [
        {
          id: 1,
          tier: 1,
          rule: 'test-rule',
          priority: 'HIGH',
          title: 'Test Step',
          description: 'A test step',
          rationale: '',
          scoreImpact: [],
          operations: [
            { type: 'CREATE', path: join(sandboxDir, 'new-file.ts'), description: '', content: 'export const newFile = true;' },
            { type: 'MODIFY', path: file1, description: '', content: 'const a = 2;' },
            { type: 'MOVE', path: file1, newPath: join(sandboxDir, 'moved-file.ts'), description: '' }
          ]
        }
      ]
    };

    // Override git commit in test
    // execSync bypassed natively in the class when cross-env is test

    await executor.executePlan(plan);

    // Verify
    expect(existsSync(join(sandboxDir, 'new-file.ts'))).toBe(true);
    expect(readFileSync(join(sandboxDir, 'new-file.ts'), 'utf-8')).toBe('export const newFile = true;');

    expect(existsSync(file1)).toBe(false); // It was moved!
    expect(existsSync(join(sandboxDir, 'moved-file.ts'))).toBe(true);
    // After modify then move, it should be the new content
    expect(readFileSync(join(sandboxDir, 'moved-file.ts'), 'utf-8')).toBe('const a = 2;');
  });

  it('should use AIProvider when aiPrompt is present', async () => {
    const executor = new AgentExecutor(true);
    
    const file1 = join(sandboxDir, 'ugly-code.ts');
    writeFileSync(file1, 'function doX() {}', 'utf-8');

    const plan: RefactoringPlan = {
      timestamp: new Date().toISOString(),
      projectPath: sandboxDir,
      currentScore: { overall: 50, breakdown: { modularity: 50, coupling: 50, cohesion: 50, layering: 50 } } as any,
      estimatedScoreAfter: { overall: 60, breakdown: {} },
      totalOperations: 1,
      tier1Steps: 1,
      tier2Steps: 0,
      steps: [
        {
          id: 1,
          tier: 1,
          rule: 'ai-rule',
          priority: 'CRITICAL',
          title: 'AI Step',
          description: 'Uses AI',
          rationale: '',
          scoreImpact: [],
          aiPrompt: 'Make it clean',
          operations: [
            { type: 'MODIFY', path: file1, description: 'AI rewrite' }
          ]
        }
      ]
    };

    // execSync bypassed natively in the class when cross-env is test

    await executor.executePlan(plan);

    const result = readFileSync(file1, 'utf-8');
    expect(result).toContain('// MOCKED AI RESULT');
    expect(result).toContain('function doX() {}');
    expect(ModelProviderFactory.createProvider).toHaveBeenCalled();
  });
});
