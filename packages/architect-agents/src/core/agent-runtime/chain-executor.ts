/**
 * PromptChainExecutor — Online Multi-Pass Execution Runtime
 *
 * Executes PromptChain objects through an AI provider, feeding the
 * output of each pass as context into the next. Supports retries,
 * provider switching, and rollback on failure.
 *
 * This completes the Genesis Engine v2 pipeline:
 *   RefactorEngine → MultiPassGenerator → PromptChainExecutor → AgentExecutor
 *
 * @since v10.0.0 — Phase 3.1
 */

import type { PromptChain, PromptPass } from './multi-pass-generator.js';
import type { AIProvider } from './ai-provider.js';

// ── Types ─────────────────────────────────────────────────

export interface PassResult {
  passNumber: number;
  objective: string;
  output: string;
  durationMs: number;
  tokensEstimated: number;
  success: boolean;
  error?: string;
}

export interface ChainResult {
  stepId: number;
  rule: string;
  totalPasses: number;
  passesCompleted: number;
  passResults: PassResult[];
  finalOutput: string;
  totalDurationMs: number;
  success: boolean;
}

export interface ChainExecutorOptions {
  /** Max retries per pass on AI failure */
  maxRetries: number;
  /** Delay between retries in ms */
  retryDelayMs: number;
  /** Max tokens to include from previous pass output (prevents context overflow) */
  maxContextTokens: number;
  /** Callback for progress reporting */
  onPassComplete?: (result: PassResult, chain: PromptChain) => void;
  /** Callback before each pass starts */
  onPassStart?: (pass: PromptPass, chain: PromptChain) => void;
}

const DEFAULT_OPTIONS: ChainExecutorOptions = {
  maxRetries: 2,
  retryDelayMs: 1000,
  maxContextTokens: 60_000,
};

// ── Executor ──────────────────────────────────────────────

export class PromptChainExecutor {
  private provider: AIProvider;
  private options: ChainExecutorOptions;

  constructor(provider: AIProvider, options?: Partial<ChainExecutorOptions>) {
    this.provider = provider;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Switch the AI provider mid-chain (e.g., if one provider gives bad results).
   */
  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  /**
   * Execute a full prompt chain, pass by pass.
   * Each pass receives the output of its dependency pass as context.
   */
  async executeChain(chain: PromptChain): Promise<ChainResult> {
    const start = Date.now();
    const passOutputs = new Map<number, string>();
    const passResults: PassResult[] = [];
    let lastOutput = '';

    for (const pass of chain.passes) {
      this.options.onPassStart?.(pass, chain);

      // Build context from dependency pass
      const context = this.buildPassContext(pass, passOutputs);

      // Execute with retries
      const result = await this.executePass(pass, context);
      passResults.push(result);

      if (!result.success) {
        return {
          stepId: chain.stepId,
          rule: chain.rule,
          totalPasses: chain.passCount,
          passesCompleted: passResults.filter(r => r.success).length,
          passResults,
          finalOutput: lastOutput,
          totalDurationMs: Date.now() - start,
          success: false,
        };
      }

      passOutputs.set(pass.passNumber, result.output);
      lastOutput = result.output;

      this.options.onPassComplete?.(result, chain);
    }

    return {
      stepId: chain.stepId,
      rule: chain.rule,
      totalPasses: chain.passCount,
      passesCompleted: passResults.length,
      passResults,
      finalOutput: lastOutput,
      totalDurationMs: Date.now() - start,
      success: true,
    };
  }

  /**
   * Execute multiple chains sequentially (for a full refactoring plan).
   */
  async executeAll(chains: PromptChain[]): Promise<ChainResult[]> {
    const results: ChainResult[] = [];
    for (const chain of chains) {
      results.push(await this.executeChain(chain));
    }
    return results;
  }

  // ── Internal ────────────────────────────────────────────

  private buildPassContext(
    pass: PromptPass,
    passOutputs: Map<number, string>,
  ): string {
    if (pass.contextSource === 'source' || pass.passNumber === 1) {
      return ''; // First pass uses source context (already in the prompt)
    }

    const depPassNumber = pass.dependsOn ?? pass.passNumber - 1;
    const previousOutput = passOutputs.get(depPassNumber);

    if (!previousOutput) {
      return '(No output available from previous pass)';
    }

    // Truncate if over budget
    const estimated = Math.ceil(previousOutput.length / 4);
    if (estimated > this.options.maxContextTokens) {
      const maxChars = this.options.maxContextTokens * 4;
      return previousOutput.slice(0, maxChars) +
        `\n\n... (truncated — ${estimated} tokens total, limit: ${this.options.maxContextTokens})`;
    }

    return previousOutput;
  }

  private async executePass(pass: PromptPass, context: string): Promise<PassResult> {
    const start = Date.now();
    let lastError = '';

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        // Build the full prompt with context injection
        const fullPrompt = context
          ? `${pass.content}\n\n## Context from Previous Pass\n\n${context}`
          : pass.content;

        // Use empty string as "file content" since chain passes are self-contained
        const output = await this.provider.executeRefactoringPrompt('', fullPrompt);

        return {
          passNumber: pass.passNumber,
          objective: pass.objective,
          output,
          durationMs: Date.now() - start,
          tokensEstimated: Math.ceil(output.length / 4),
          success: true,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);

        if (attempt < this.options.maxRetries) {
          await this.delay(this.options.retryDelayMs * (attempt + 1));
        }
      }
    }

    return {
      passNumber: pass.passNumber,
      objective: pass.objective,
      output: '',
      durationMs: Date.now() - start,
      tokensEstimated: 0,
      success: false,
      error: `Failed after ${this.options.maxRetries + 1} attempts: ${lastError}`,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
