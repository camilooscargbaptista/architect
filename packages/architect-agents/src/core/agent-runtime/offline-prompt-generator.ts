import * as fs from 'fs';
import * as path from 'path';
import { RefactoringPlan } from '@girardelli/architect-core/src/core/types/rules.js';
import {
  DEFAULT_BUDGET,
  estimateTokens,
  classifyOperation,
  abbreviateFileContent,
  RESPONSE_FORMAT_DIRECTIVE,
  type PromptBudgetConfig,
  type OperationPriority,
} from './prompt-budget.js';
import { MultiPassGenerator, type PromptChain } from './multi-pass-generator.js';

/**
 * Offline Prompt Generator — Generates AI-ready markdown prompts from
 * a RefactoringPlan.
 *
 * v9.0 — Fase 3.1: Multi-pass prompt generation via MultiPassGenerator.
 * Complex refactoring steps are decomposed into sequential passes where
 * each pass feeds the next, enabling LLMs to handle operations that are
 * impossible in a single context window.
 *
 * Fixes applied (v8.2.0):
 * - Fix 0.3: Token budget system with progressive disclosure
 * - Fix 0.6: Consumer follow-up block for cascading import updates
 */
export class OfflinePromptGenerator {
  private budget: PromptBudgetConfig;
  private multiPass: MultiPassGenerator;

  constructor(budget?: Partial<PromptBudgetConfig>) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
    this.multiPass = new MultiPassGenerator();
  }

  generate(plan: RefactoringPlan, outputDir: string = 'packages/architect/prompts') {
    const cwd = process.cwd();
    const absoluteOutputDir = path.resolve(cwd, outputDir);

    if (!fs.existsSync(absoluteOutputDir)) {
      fs.mkdirSync(absoluteOutputDir, { recursive: true });
    }

    // ── Fase 3.1: Decompose all steps into prompt chains ──
    const chains: PromptChain[] = plan.steps.map(step => this.multiPass.decompose(step));

    // Generate Index file (now multi-pass aware)
    const indexContent = this.generateIndex(plan, chains);
    fs.writeFileSync(path.join(absoluteOutputDir, '00-index.md'), indexContent, 'utf8');

    // Generate prompt files — multi-pass steps get one file per pass
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]!;
      const chain = chains[i]!;
      const prefix = String(step.id).padStart(2, '0');

      if (chain.passCount === 1) {
        // Single-pass: backward-compatible single file
        const fileName = `${prefix}-step-${step.id}.md`;
        const filePath = path.join(absoluteOutputDir, fileName);
        const promptContent = this.generateStepPrompt(step, cwd);
        fs.writeFileSync(filePath, promptContent, 'utf8');
      } else {
        // Multi-pass: one file per pass
        for (const pass of chain.passes) {
          const fileName = `${prefix}-step-${step.id}-pass-${pass.passNumber}.md`;
          const filePath = path.join(absoluteOutputDir, fileName);
          const promptContent = this.generatePassPrompt(step, chain, pass);
          fs.writeFileSync(filePath, promptContent, 'utf8');
        }
      }
    }
  }

  private generateIndex(plan: RefactoringPlan, chains: PromptChain[]): string {
    const totalPasses = chains.reduce((sum, c) => sum + c.passCount, 0);
    const multiPassSteps = chains.filter(c => c.passCount > 1).length;

    // Build step listing with multi-pass awareness
    const stepLines: string[] = [];
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i]!;
      const chain = chains[i]!;
      const prefix = String(step.id).padStart(2, '0');

      if (chain.passCount === 1) {
        stepLines.push(`- [ ] [Step #${step.id}] ${step.title} (File: ${prefix}-step-${step.id}.md)`);
      } else {
        stepLines.push(`- [ ] [Step #${step.id}] ${step.title} — **${chain.passCount} passes** (${chain.rule})`);
        for (const pass of chain.passes) {
          const depNote = pass.dependsOn ? ` ← depends on pass ${pass.dependsOn}` : '';
          stepLines.push(`  - [ ] Pass ${pass.passNumber}: ${pass.objective} (File: ${prefix}-step-${step.id}-pass-${pass.passNumber}.md)${depNote}`);
        }
      }
    }

    return `# Architect Genesis v2 — Multi-Pass Prompt Engineering

This folder contains the complete Refactoring Plan extracted from your architecture analysis.
Use these files to trigger AI refactoring via web interfaces (ChatGPT, Claude, Gemini, etc.)
without exposing your code directly via APIs.

## Mission Overview
**Total Steps:** ${plan.steps.length}
**Total Prompt Files:** ${totalPasses}
**Multi-Pass Steps:** ${multiPassSteps}
**Total Operations:** ${plan.totalOperations}
**Projected Quality Gain:** +${plan.estimatedScoreAfter.overall - plan.currentScore.overall} pts

## Multi-Pass Execution Guide

Steps with multiple passes must be executed **sequentially**. Each pass produces
output that feeds into the next. Copy the AI's response from Pass N and include it
as context when running Pass N+1.

## Budget Configuration
- Max tokens per prompt: ${this.budget.maxTokensPerPrompt.toLocaleString()}
- Max full file inlines per step: ${this.budget.maxFullFileInlines}
- Max lines per file: ${this.budget.maxLinesPerFile}

## Steps

${stepLines.join('\n')}

---
*Generated by Genesis Engine v2 (Multi-Pass) — Architect v9.0*
`;
  }

  /**
   * Generate a markdown prompt for a single pass within a multi-pass chain.
   * Includes chain navigation metadata so the user knows the execution flow.
   */
  private generatePassPrompt(
    step: { id: number; title: string; rule: string },
    chain: PromptChain,
    pass: import('./multi-pass-generator.js').PromptPass,
  ): string {
    const prefix = String(step.id).padStart(2, '0');
    const isFirst = pass.passNumber === 1;
    const isLast = pass.passNumber === chain.passCount;

    let content = `# Step #${step.id}: ${step.title}
## Pass ${pass.passNumber} of ${chain.passCount}: ${pass.objective}

**Rule:** ${step.rule}
**Context source:** ${pass.contextSource === 'source' ? 'Original file content' : pass.contextSource === 'previous' ? `Output from Pass ${pass.dependsOn ?? pass.passNumber - 1}` : 'Structured analysis from prior pass'}
**Output contract:** ${pass.outputContract}

`;

    // Navigation hints
    if (!isFirst) {
      const prevFile = `${prefix}-step-${step.id}-pass-${pass.passNumber - 1}.md`;
      content += `> **Input required:** Copy the AI response from Pass ${pass.passNumber - 1} (${prevFile}) and paste it below before running this prompt.\n\n`;
      content += `<paste_previous_pass_output_here>\n\n---\n\n`;
    }

    content += `## Architect AI Prompt
_Copy and paste the text block below directly into your AI Chat._

---

You are a strict Software Architect AI executing **Pass ${pass.passNumber}/${chain.passCount}** of a multi-pass refactoring chain.

${pass.content}

`;

    // Output format directive
    content += `---\n\n${RESPONSE_FORMAT_DIRECTIVE}\n`;

    // Next pass hint
    if (!isLast) {
      const nextFile = `${prefix}-step-${step.id}-pass-${pass.passNumber + 1}.md`;
      content += `\n---\n\n> **Next:** Copy the AI response above and proceed to Pass ${pass.passNumber + 1} (${nextFile})\n`;
    } else {
      content += `\n---\n\n> **Done:** This is the final pass for Step #${step.id}. Apply the changes to your codebase.\n`;
    }

    return content;
  }

  private generateStepPrompt(
    step: { id: number; title: string; rule: string; aiPrompt?: string; operations: Array<{ type: string; path: string; description?: string; content?: string }> },
    cwd: string,
  ): string {
    let promptContent = `# Step #${step.id}: ${step.title}

## Anti-Pattern Context
**Rule Violated**: ${step.rule}

## Architect AI Prompt
_Copy and paste the text block below directly into your AI Chat to act as your autonomous agent._

---

You are a strict Software Architect AI. Please rewrite the following file(s) according to the architectural directives.

**Task Directive:**
${step.aiPrompt || 'Refactor the given code to satisfy the ' + step.rule + ' architectural rule by decoupling infrastructure from domain.'}

`;

    // ── Fix 0.3: Budget-aware file inlining ──

    // Classify and sort operations by priority
    const classifiedOps = step.operations.map(op => ({
      ...op,
      priority: classifyOperation(op) as OperationPriority,
    }));

    classifiedOps.sort((a, b) => {
      const order: Record<OperationPriority, number> = {
        'core-target': 0,
        'important-context': 1,
        'consumer-ref': 2,
      };
      return order[a.priority] - order[b.priority];
    });

    let tokenBudget = this.budget.maxTokensPerPrompt;
    let fullFileCount = 0;
    const consumerOps: Array<{ path: string; description?: string }> = [];

    for (const op of classifiedOps) {
      if (op.type === 'MODIFY') {
        const ext = path.extname(op.path).substring(1) || 'ts';

        if (op.priority === 'consumer-ref') {
          // ── Fix 0.6: Collect consumer references for follow-up block ──
          const consumerOp: { path: string; description?: string } = { path: op.path };
          if (op.description) consumerOp.description = op.description;
          consumerOps.push(consumerOp);
          continue;
        }

        // Read file content
        let fileContent = '';
        try {
          fileContent = fs.readFileSync(path.resolve(cwd, op.path), 'utf8');
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          fileContent = `// Error reading file context: ${message}`;
        }

        const fileTokens = estimateTokens(fileContent);

        if (
          op.priority === 'core-target' ||
          (op.priority === 'important-context' &&
            fileTokens < tokenBudget &&
            fullFileCount < this.budget.maxFullFileInlines)
        ) {
          // Full inline with line cap
          const lines = fileContent.split('\n');
          const capped = lines.length > this.budget.maxLinesPerFile
            ? lines.slice(0, this.budget.maxLinesPerFile).join('\n') +
              `\n// ... truncated (${lines.length} total lines)`
            : fileContent;

          promptContent += `\n### Current State of \`${op.path}\`\n`;
          promptContent += `\`\`\`${ext}\n${capped}\n\`\`\`\n`;
          tokenBudget -= estimateTokens(capped);
          fullFileCount++;
        } else if (this.budget.includeAbbreviatedContext) {
          // Abbreviated: interface-only view
          const abbreviated = abbreviateFileContent(fileContent, ext);
          promptContent += `\n### Interface Summary of \`${op.path}\` (abbreviated)\n`;
          promptContent += `\`\`\`${ext}\n${abbreviated}\n\`\`\`\n`;
          tokenBudget -= estimateTokens(abbreviated);
        } else {
          promptContent += `\n### \`${op.path}\` — Update imports as described above\n`;
        }
      } else if (op.type === 'CREATE' && op.content) {
        promptContent += `\n### Target: Create \`${op.path}\`\n`;
        promptContent += `Template:\n\`\`\`\n${op.content}\n\`\`\`\n`;
        tokenBudget -= estimateTokens(op.content);
      } else {
        promptContent += `\n### Target Operation for \`${op.path}\`\n`;
        promptContent += `[${op.type}] ${op.description || 'instruction required.'}\n`;
      }
    }

    // ── Fix 0.6: Consumer follow-up block ──
    if (consumerOps.length > 0) {
      promptContent += `\n## Manual Follow-up Required\n\n`;
      promptContent += `After applying the changes above, update the following ${consumerOps.length} consumer file(s):\n\n`;
      for (const op of consumerOps) {
        promptContent += `- \`${op.path}\` — ${op.description || 'Update imports to match new file structure'}\n`;
      }
      promptContent += `\n**Tip:** Use your IDE's Find & Replace across the project.\n`;
      promptContent += `Search for the old import path and replace with the new one shown in the refactored code above.\n`;
    }

    // ── Fix 0.3: Append response format directive ──
    promptContent += `\n---\n\n${RESPONSE_FORMAT_DIRECTIVE}\n`;

    return promptContent;
  }
}
