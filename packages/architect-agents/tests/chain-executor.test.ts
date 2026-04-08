import { PromptChainExecutor } from '../src/core/agent-runtime/chain-executor.js';
import type { PromptChain, PromptPass } from '../src/core/agent-runtime/multi-pass-generator.js';
import type { AIProvider } from '../src/core/agent-runtime/ai-provider.js';

// ── Mock AI Provider ─────────────────────────────────────

class MockAIProvider implements AIProvider {
  calls: Array<{ fileContent: string; prompt: string }> = [];
  responses: string[] = [];
  shouldFail = false;
  failCount = 0;
  private callIndex = 0;

  async executeRefactoringPrompt(fileContent: string, prompt: string): Promise<string> {
    this.calls.push({ fileContent, prompt });
    if (this.shouldFail) {
      if (this.failCount > 0) {
        this.failCount--;
        throw new Error('Mock AI failure');
      }
      this.shouldFail = false;
    }
    return this.responses[this.callIndex++] ?? `Response for pass ${this.callIndex}`;
  }
}

// ── Test Helpers ─────────────────────────────────────────

function makePass(num: number, overrides?: Partial<PromptPass>): PromptPass {
  return {
    passNumber: num,
    objective: `Pass ${num} objective`,
    contextSource: num === 1 ? 'source' : 'previous',
    outputContract: `Output for pass ${num}`,
    content: `Prompt content for pass ${num}`,
    ...(num > 1 ? { dependsOn: num - 1 } : {}),
    ...overrides,
  };
}

function makeChain(passCount: number, overrides?: Partial<PromptChain>): PromptChain {
  const passes = Array.from({ length: passCount }, (_, i) => makePass(i + 1));
  return {
    stepId: 1,
    stepTitle: 'Test step',
    rule: 'hub-splitter',
    passCount,
    passes,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────

describe('PromptChainExecutor', () => {
  let provider: MockAIProvider;

  beforeEach(() => {
    provider = new MockAIProvider();
    provider.responses = ['Analysis result', 'Split code', 'Updated imports'];
  });

  describe('executeChain', () => {
    it('should execute a single-pass chain', async () => {
      const executor = new PromptChainExecutor(provider);
      const chain = makeChain(1);
      provider.responses = ['Refactored code'];

      const result = await executor.executeChain(chain);

      expect(result.success).toBe(true);
      expect(result.totalPasses).toBe(1);
      expect(result.passesCompleted).toBe(1);
      expect(result.finalOutput).toBe('Refactored code');
      expect(provider.calls.length).toBe(1);
    });

    it('should execute a 3-pass chain feeding output between passes', async () => {
      const executor = new PromptChainExecutor(provider);
      const chain = makeChain(3);

      const result = await executor.executeChain(chain);

      expect(result.success).toBe(true);
      expect(result.totalPasses).toBe(3);
      expect(result.passesCompleted).toBe(3);
      expect(result.passResults.length).toBe(3);
      expect(result.finalOutput).toBe('Updated imports');

      // Verify pass 2 received pass 1 output as context
      expect(provider.calls[1]!.prompt).toContain('Analysis result');
      // Verify pass 3 received pass 2 output as context
      expect(provider.calls[2]!.prompt).toContain('Split code');
    });

    it('should stop chain on pass failure', async () => {
      provider.shouldFail = true;
      provider.failCount = 10; // Always fail
      const executor = new PromptChainExecutor(provider, { maxRetries: 0 });
      const chain = makeChain(3);

      const result = await executor.executeChain(chain);

      expect(result.success).toBe(false);
      expect(result.passesCompleted).toBe(0);
      expect(result.passResults.length).toBe(1);
      expect(result.passResults[0]!.success).toBe(false);
      expect(result.passResults[0]!.error).toContain('Mock AI failure');
    });

    it('should retry on transient failure', async () => {
      provider.shouldFail = true;
      provider.failCount = 1; // Fail once then succeed
      provider.responses = ['Success after retry', 'Pass 2', 'Pass 3'];
      const executor = new PromptChainExecutor(provider, { maxRetries: 2, retryDelayMs: 10 });
      const chain = makeChain(1);

      const result = await executor.executeChain(chain);

      expect(result.success).toBe(true);
      expect(provider.calls.length).toBe(2); // 1 fail + 1 success
    });

    it('should include timing in results', async () => {
      const executor = new PromptChainExecutor(provider);
      const chain = makeChain(1);

      const result = await executor.executeChain(chain);

      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.passResults[0]!.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should estimate tokens for output', async () => {
      provider.responses = ['x'.repeat(400)]; // ~100 tokens
      const executor = new PromptChainExecutor(provider);
      const chain = makeChain(1);

      const result = await executor.executeChain(chain);

      expect(result.passResults[0]!.tokensEstimated).toBe(100);
    });

    it('should report step metadata', async () => {
      const executor = new PromptChainExecutor(provider);
      const chain = makeChain(2, { stepId: 42, rule: 'barrel-optimizer' });

      const result = await executor.executeChain(chain);

      expect(result.stepId).toBe(42);
      expect(result.rule).toBe('barrel-optimizer');
    });
  });

  describe('executeAll', () => {
    it('should execute multiple chains sequentially', async () => {
      provider.responses = ['A1', 'B1', 'B2'];
      const executor = new PromptChainExecutor(provider);
      const chains = [
        makeChain(1, { stepId: 1 }),
        makeChain(2, { stepId: 2 }),
      ];

      const results = await executor.executeAll(chains);

      expect(results.length).toBe(2);
      expect(results[0]!.success).toBe(true);
      expect(results[1]!.success).toBe(true);
      expect(results[0]!.stepId).toBe(1);
      expect(results[1]!.stepId).toBe(2);
    });
  });

  describe('setProvider', () => {
    it('should switch provider mid-execution', async () => {
      const provider2 = new MockAIProvider();
      provider2.responses = ['New provider output'];
      provider.responses = ['First pass from original'];

      const executor = new PromptChainExecutor(provider);

      // Execute first chain with original provider
      const chain1 = makeChain(1, { stepId: 1 });
      await executor.executeChain(chain1);
      expect(provider.calls.length).toBe(1);

      // Switch provider
      executor.setProvider(provider2);

      // Execute second chain with new provider
      const chain2 = makeChain(1, { stepId: 2 });
      const result = await executor.executeChain(chain2);
      expect(result.finalOutput).toBe('New provider output');
      expect(provider2.calls.length).toBe(1);
    });
  });

  describe('context truncation', () => {
    it('should truncate large pass output to maxContextTokens', async () => {
      // Pass 1 returns huge output
      const hugeOutput = 'x'.repeat(500_000); // ~125K tokens
      provider.responses = [hugeOutput, 'Final'];
      const executor = new PromptChainExecutor(provider, { maxContextTokens: 1000 });
      const chain = makeChain(2);

      const result = await executor.executeChain(chain);

      expect(result.success).toBe(true);
      // Pass 2 prompt should contain truncated context
      const pass2Prompt = provider.calls[1]!.prompt;
      expect(pass2Prompt).toContain('truncated');
      expect(pass2Prompt.length).toBeLessThan(hugeOutput.length);
    });
  });

  describe('callbacks', () => {
    it('should call onPassStart and onPassComplete', async () => {
      const starts: number[] = [];
      const completes: number[] = [];

      const executor = new PromptChainExecutor(provider, {
        maxRetries: 0,
        retryDelayMs: 0,
        maxContextTokens: 60_000,
        onPassStart: (pass) => starts.push(pass.passNumber),
        onPassComplete: (result) => completes.push(result.passNumber),
      });
      const chain = makeChain(3);

      await executor.executeChain(chain);

      expect(starts).toEqual([1, 2, 3]);
      expect(completes).toEqual([1, 2, 3]);
    });

    it('should not call onPassComplete on failure', async () => {
      provider.shouldFail = true;
      provider.failCount = 10;
      const completes: number[] = [];

      const executor = new PromptChainExecutor(provider, {
        maxRetries: 0,
        retryDelayMs: 0,
        maxContextTokens: 60_000,
        onPassComplete: (result) => completes.push(result.passNumber),
      });
      const chain = makeChain(2);

      await executor.executeChain(chain);

      expect(completes).toEqual([]);
    });
  });
});
