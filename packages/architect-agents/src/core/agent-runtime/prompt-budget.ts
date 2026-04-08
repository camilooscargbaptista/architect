/**
 * Prompt Budget System — Controls token usage in generated prompts.
 *
 * Prevents Genesis Engine from generating 500KB+ prompts by:
 * 1. Classifying operations by priority (core-target, important-context, consumer-ref)
 * 2. Enforcing token budgets with progressive disclosure
 * 3. Abbreviating low-priority file inlines to interface-only views
 *
 * @since v8.2.0
 * @see EVOLUTION_PLAN.md Fix 0.3
 */

// ── Configuration ────────────────────────────────────────────────────

export interface PromptBudgetConfig {
  /** Max estimated tokens per prompt file. Default: 30000 (~120KB text) */
  maxTokensPerPrompt: number;
  /** Max number of full file inlines per step. Default: 5 */
  maxFullFileInlines: number;
  /** Max lines per individual file inline. Default: 300 */
  maxLinesPerFile: number;
  /** Whether to include abbreviated context for overflow files. Default: true */
  includeAbbreviatedContext: boolean;
}

export const DEFAULT_BUDGET: PromptBudgetConfig = {
  maxTokensPerPrompt: 30_000,
  maxFullFileInlines: 5,
  maxLinesPerFile: 300,
  includeAbbreviatedContext: true,
};

// ── Model Presets ────────────────────────────────────────────────────

export type GenesisTargetModel = 'gpt-4o' | 'claude-3' | 'gemini-pro' | 'qwen-32b' | 'custom';

/**
 * Pre-configured token budgets per target model.
 * Budget is set to ~25% of context window — leaves room for
 * system prompt, response, and safety margin.
 */
export const MODEL_PRESETS: Record<Exclude<GenesisTargetModel, 'custom'>, Partial<PromptBudgetConfig>> = {
  'gpt-4o':     { maxTokensPerPrompt: 40_000, maxFullFileInlines: 8 },   // 128K context
  'claude-3':   { maxTokensPerPrompt: 60_000, maxFullFileInlines: 10 },  // 200K context
  'gemini-pro': { maxTokensPerPrompt: 100_000, maxFullFileInlines: 15 }, // 1M context
  'qwen-32b':   { maxTokensPerPrompt: 8_000, maxFullFileInlines: 3, maxLinesPerFile: 150 }, // 32K context
};

/**
 * Resolves a PromptBudgetConfig from a GenesisConfig (from architect.config).
 * Priority: explicit fields > model preset > defaults.
 */
export function resolveBudget(genesis?: {
  maxTokensPerPrompt?: number;
  maxFullFileInlines?: number;
  maxLinesPerFile?: number;
  includeAbbreviatedContext?: boolean;
  targetModel?: GenesisTargetModel;
  customTokenLimit?: number;
}): PromptBudgetConfig {
  if (!genesis) return DEFAULT_BUDGET;

  // Start with defaults
  let base: PromptBudgetConfig = { ...DEFAULT_BUDGET };

  // Apply model preset if specified
  if (genesis.targetModel && genesis.targetModel !== 'custom') {
    const preset = MODEL_PRESETS[genesis.targetModel];
    base = { ...base, ...preset };
  } else if (genesis.targetModel === 'custom' && genesis.customTokenLimit) {
    base.maxTokensPerPrompt = genesis.customTokenLimit;
  }

  // Override with explicit values
  if (genesis.maxTokensPerPrompt !== undefined) base.maxTokensPerPrompt = genesis.maxTokensPerPrompt;
  if (genesis.maxFullFileInlines !== undefined) base.maxFullFileInlines = genesis.maxFullFileInlines;
  if (genesis.maxLinesPerFile !== undefined) base.maxLinesPerFile = genesis.maxLinesPerFile;
  if (genesis.includeAbbreviatedContext !== undefined) base.includeAbbreviatedContext = genesis.includeAbbreviatedContext;

  return base;
}

// ── Token Estimation ─────────────────────────────────────────────────

/** Rough token estimate: ~4 chars per token (industry standard for code) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Operation Classification ─────────────────────────────────────────

export type OperationPriority = 'core-target' | 'important-context' | 'consumer-ref';

/**
 * Classifies an operation by its importance for prompt generation.
 *
 * - CREATE/SPLIT → core-target: always inline full content
 * - MODIFY with substantial changes → important-context: inline if budget allows
 * - MODIFY with simple import updates → consumer-ref: abbreviated annotation only
 * - DELETE → consumer-ref: just a note
 */
export function classifyOperation(
  op: { type: string; description?: string },
): OperationPriority {
  if (op.type === 'CREATE' || op.type === 'SPLIT') return 'core-target';
  if (op.type === 'DELETE') return 'consumer-ref';

  // MODIFY: check if it's a simple import update
  const desc = (op.description || '').toLowerCase();
  const isSimpleUpdate =
    desc.includes('update import') ||
    desc.includes('update require') ||
    desc.includes('find and replace') ||
    desc.includes('replace barrel import');

  return isSimpleUpdate ? 'consumer-ref' : 'important-context';
}

// ── File Abbreviation ────────────────────────────────────────────────

/**
 * Generates abbreviated context: head + exports + tail.
 * Enough to understand the interface without consuming token budget.
 */
export function abbreviateFileContent(content: string, ext: string): string {
  const lines = content.split('\n');
  if (lines.length <= 40) return content; // Small enough, include full

  const HEAD_LINES = 20;
  const TAIL_LINES = 5;
  const omitted = lines.length - HEAD_LINES - TAIL_LINES;

  const head = lines.slice(0, HEAD_LINES).join('\n');

  // Extract exported interface (language-aware)
  const exportPatterns = [
    /^export\s/,           // TS/JS
    /^module\.exports/,    // CJS
    /^pub\s/,              // Rust
    /^def\s/,              // Python
    /^class\s/,            // Python/Java
    /^func\s/,             // Go
    /^public\s/,           // Java
  ];

  const exports = lines
    .filter(l => exportPatterns.some(p => p.test(l.trim())))
    .join('\n');

  const tail = lines.slice(-TAIL_LINES).join('\n');

  const commentPrefix = ['py'].includes(ext) ? '#' : '//';

  return [
    head,
    '',
    `${commentPrefix} ... (${omitted} lines omitted — see full file at original path)`,
    '',
    `${commentPrefix} === Exported Interface ===`,
    exports || `${commentPrefix} (no top-level exports detected)`,
    '',
    `${commentPrefix} === End of File ===`,
    tail,
  ].join('\n');
}

// ── Response Format Directive ────────────────────────────────────────

export const RESPONSE_FORMAT_DIRECTIVE = `
## Response Format

Return EACH modified or created file in a separate fenced code block.
The FIRST LINE inside each code block MUST be a comment with the FULL file path.

Example:
\`\`\`typescript
// src/core/repos/user-repo.ts
import { Database } from '../shared/database.js';
// ... rest of file
\`\`\`

Rules:
1. Include the COMPLETE file content, not just diffs
2. One code block per file — never combine multiple files
3. If a file needs no changes, do NOT include it
4. Preserve all existing functionality unless explicitly told to modify it
`.trim();
