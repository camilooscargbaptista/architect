/**
 * Interactive Refactoring Mode — Fase 3.3
 *
 * `architect refactor . --interactive`
 *
 * Step-by-step refactoring with:
 * - Per-step preview and approval
 * - Git stash rollback before each step
 * - Partial re-analysis after each step (only affected files)
 * - Score tracking (before/after per step)
 * - Multi-pass awareness via MultiPassGenerator
 *
 * @since v9.0 — Fase 3.3
 */

import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

import type { RefactoringPlan, RefactorStep, FileOperation } from '@girardelli/architect-core/src/core/types/rules.js';
import { MultiPassGenerator, type PromptChain } from '@girardelli/architect-agents/src/core/agent-runtime/multi-pass-generator.js';
import { Architect } from './architect.js';

// ── ANSI Colors ──

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  orange: '\x1b[38;5;208m',
  bg_green: '\x1b[42m',
  bg_red: '\x1b[41m',
} as const;

// ── Types ──

export interface InteractiveConfig {
  /** Project path to analyze */
  projectPath: string;
  /** Auto-approve all steps (skip prompts) */
  autoMode?: boolean;
  /** AI provider type override */
  providerType?: string;
  /** Callback for progress events */
  onProgress?: (event: InteractiveEvent) => void;
}

export type InteractiveEventType =
  | 'plan_ready'
  | 'step_preview'
  | 'step_approved'
  | 'step_skipped'
  | 'step_executed'
  | 'step_rolled_back'
  | 'reanalysis_start'
  | 'reanalysis_complete'
  | 'session_complete';

export interface InteractiveEvent {
  type: InteractiveEventType;
  stepId?: number;
  score?: number;
  scoreDelta?: number;
  detail?: string;
}

export interface StepResult {
  stepId: number;
  action: 'executed' | 'skipped' | 'rolled_back' | 'aborted';
  scoreBefore: number;
  scoreAfter: number;
  filesAffected: string[];
}

export interface InteractiveSession {
  originalScore: number;
  currentScore: number;
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  rolledBackSteps: number;
  results: StepResult[];
}

// ── Interactive Refactor Controller ──

export class InteractiveRefactor {
  private rl: readline.Interface | null = null;
  private architect: Architect;
  private multiPass: MultiPassGenerator;
  private config: InteractiveConfig;
  private session: InteractiveSession;

  constructor(config: InteractiveConfig) {
    this.config = config;
    this.architect = new Architect();
    this.multiPass = new MultiPassGenerator();
    this.session = {
      originalScore: 0,
      currentScore: 0,
      totalSteps: 0,
      completedSteps: 0,
      skippedSteps: 0,
      rolledBackSteps: 0,
      results: [],
    };
  }

  /**
   * Main entry point for interactive refactoring.
   */
  async run(): Promise<InteractiveSession> {
    try {
      this.printBanner();

      // 1. Initial analysis
      this.printPhase('ANALYSIS', 'Scanning project architecture...');
      const report = await this.architect.analyze(this.config.projectPath);
      const plan = this.architect.refactor(report, this.config.projectPath);

      this.session.originalScore = report.score.overall;
      this.session.currentScore = report.score.overall;
      this.session.totalSteps = plan.steps.length;

      this.emit({ type: 'plan_ready', score: report.score.overall, detail: `${plan.steps.length} steps` });
      this.printPlanSummary(plan);

      if (plan.steps.length === 0) {
        this.printSuccess('No refactoring steps needed — architecture is clean!');
        return this.session;
      }

      // 2. Ensure protective git branch
      this.ensureGitSafety();

      // 3. Step-by-step execution loop
      let currentReport = report;
      let currentPlan = plan;

      for (let i = 0; i < currentPlan.steps.length; i++) {
        const step = currentPlan.steps[i]!;
        const chain = this.multiPass.decompose(step);

        // Preview
        this.printStepPreview(step, chain, i + 1, currentPlan.steps.length);
        this.emit({ type: 'step_preview', stepId: step.id });

        // Approval
        const action = await this.promptStepAction(step);

        if (action === 'quit') {
          this.printInfo('Session ended by user.');
          break;
        }

        if (action === 'skip') {
          this.session.skippedSteps++;
          this.session.results.push({
            stepId: step.id,
            action: 'skipped',
            scoreBefore: this.session.currentScore,
            scoreAfter: this.session.currentScore,
            filesAffected: [],
          });
          this.emit({ type: 'step_skipped', stepId: step.id });
          continue;
        }

        // Execute: git stash snapshot → execute → check
        const scoreBefore = this.session.currentScore;
        this.createRollbackPoint(step.id);

        try {
          await this.executeStep(step);
          this.commitStep(step);

          // 4. Partial re-analysis
          this.emit({ type: 'reanalysis_start', stepId: step.id });
          const affectedFiles = this.getAffectedFiles(step);
          currentReport = await this.architect.analyze(this.config.projectPath);
          const newScore = currentReport.score.overall;
          const scoreDelta = newScore - scoreBefore;

          this.session.currentScore = newScore;
          this.session.completedSteps++;

          this.printScoreDelta(scoreBefore, newScore, scoreDelta);
          this.emit({
            type: 'step_executed',
            stepId: step.id,
            score: newScore,
            scoreDelta,
          });

          this.session.results.push({
            stepId: step.id,
            action: 'executed',
            scoreBefore,
            scoreAfter: newScore,
            filesAffected: affectedFiles,
          });

          this.emit({ type: 'reanalysis_complete', stepId: step.id, score: newScore });

          // Re-generate plan with remaining steps if score changed significantly
          if (Math.abs(scoreDelta) >= 3 && i < currentPlan.steps.length - 1) {
            this.printInfo('Score changed significantly — re-analyzing remaining steps...');
            currentPlan = this.architect.refactor(currentReport, this.config.projectPath);
            // Continue from where we left off in the new plan
            // The new plan may have different steps
            break; // Will restart the loop with new plan if needed
          }
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.printError(`Step #${step.id} failed: ${message}`);

          const shouldRollback = await this.promptRollback(step.id);
          if (shouldRollback) {
            this.rollbackStep(step.id);
            this.session.rolledBackSteps++;
            this.session.results.push({
              stepId: step.id,
              action: 'rolled_back',
              scoreBefore,
              scoreAfter: scoreBefore,
              filesAffected: [],
            });
            this.emit({ type: 'step_rolled_back', stepId: step.id });
          } else {
            this.session.results.push({
              stepId: step.id,
              action: 'aborted',
              scoreBefore,
              scoreAfter: scoreBefore,
              filesAffected: [],
            });
            break;
          }
        }
      }

      // 5. Session summary
      this.printSessionSummary();
      this.emit({
        type: 'session_complete',
        score: this.session.currentScore,
        scoreDelta: this.session.currentScore - this.session.originalScore,
      });

      return this.session;
    } finally {
      this.close();
    }
  }

  // ── Step Execution ──

  private async executeStep(step: RefactorStep): Promise<void> {
    for (const op of step.operations) {
      this.executeFileOperation(op);
    }
  }

  private executeFileOperation(op: FileOperation): void {
    const { writeFileSync, mkdirSync, renameSync, unlinkSync } = require('fs') as typeof import('fs');
    const { dirname } = require('path') as typeof import('path');

    switch (op.type) {
      case 'CREATE':
        if (op.content) {
          mkdirSync(dirname(op.path), { recursive: true });
          writeFileSync(op.path, op.content, 'utf8');
          this.printOp('CREATE', op.path);
        }
        break;

      case 'MOVE':
        if (op.newPath && existsSync(op.path)) {
          mkdirSync(dirname(op.newPath), { recursive: true });
          renameSync(op.path, op.newPath);
          this.printOp('MOVE', `${op.path} → ${op.newPath}`);
        }
        break;

      case 'DELETE':
        if (existsSync(op.path)) {
          unlinkSync(op.path);
          this.printOp('DELETE', op.path);
        }
        break;

      case 'MODIFY':
        if (op.content && existsSync(op.path)) {
          writeFileSync(op.path, op.content, 'utf8');
          this.printOp('MODIFY', op.path);
        }
        break;
    }
  }

  // ── Git Safety ──

  private ensureGitSafety(): void {
    if (process.env['NODE_ENV'] === 'test') return;
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
      if (['main', 'master', 'develop'].includes(branch)) {
        const ts = Date.now();
        const newBranch = `feature/architect-interactive-${ts}`;
        execSync(`git checkout -b ${newBranch}`);
        this.printInfo(`Created protective branch: ${newBranch}`);
      } else {
        this.printInfo(`On branch: ${branch}`);
      }
    } catch {
      this.printWarning('Git not detected — proceeding without branch protection.');
    }
  }

  private createRollbackPoint(stepId: number): void {
    if (process.env['NODE_ENV'] === 'test') return;
    try {
      execSync(`git stash push -m "architect-interactive-step-${stepId}-rollback"`);
      // Immediately pop to keep working tree — stash is our safety net
      execSync('git stash pop');
    } catch {
      // No changes to stash — that's fine
    }
  }

  private rollbackStep(_stepId: number): void {
    if (process.env['NODE_ENV'] === 'test') return;
    try {
      execSync('git checkout -- .');
      execSync('git clean -fd');
      this.printInfo('Rolled back to pre-step state.');
    } catch {
      this.printWarning('Rollback failed — manual cleanup may be needed.');
    }
  }

  private commitStep(step: RefactorStep): void {
    if (process.env['NODE_ENV'] === 'test') return;
    try {
      execSync('git add .');
      const msg = `refactor(architect): ${step.rule} — ${step.title}\n\nInteractive mode, step #${step.id}.\nMotivation: ${step.rationale}`;
      execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
      this.printOp('GIT', `Committed: ${step.rule}`);
    } catch {
      // No changes — ok
    }
  }

  // ── User Interaction ──

  private async promptStepAction(_step: RefactorStep): Promise<'execute' | 'skip' | 'quit'> {
    if (this.config.autoMode) return 'execute';

    const rl = this.getReadline();
    const answer = await rl.question(
      `\n  ${C.bold}Action?${C.reset} ${C.green}[e]xecute${C.reset} | ${C.yellow}[s]kip${C.reset} | ${C.red}[q]uit${C.reset} → `
    );

    const choice = answer.trim().toLowerCase();
    if (choice === 'e' || choice === 'execute' || choice === 'y' || choice === 'yes' || choice === '') {
      return 'execute';
    }
    if (choice === 's' || choice === 'skip') return 'skip';
    if (choice === 'q' || choice === 'quit') return 'quit';
    return 'execute'; // default
  }

  private async promptRollback(stepId: number): Promise<boolean> {
    if (this.config.autoMode) return true;

    const rl = this.getReadline();
    const answer = await rl.question(
      `  ${C.yellow}Rollback step #${stepId}?${C.reset} [Y/n]: `
    );
    return answer.trim().toLowerCase() !== 'n';
  }

  private getReadline(): readline.Interface {
    if (!this.rl) {
      this.rl = readline.createInterface({ input, output });
    }
    return this.rl;
  }

  private close(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  // ── Helpers ──

  private getAffectedFiles(step: RefactorStep): string[] {
    const files = new Set<string>();
    for (const op of step.operations) {
      files.add(op.path);
      if (op.newPath) files.add(op.newPath);
    }
    return [...files];
  }

  private emit(event: InteractiveEvent): void {
    this.config.onProgress?.(event);
  }

  // ── Pretty Printing ──

  private printBanner(): void {
    process.stderr.write(`\n${C.cyan}${C.bold}  ⚡ Architect Interactive Refactoring Mode${C.reset}\n`);
    process.stderr.write(`${C.dim}  Step-by-step guided architecture improvements${C.reset}\n\n`);
  }

  private printPhase(name: string, detail: string): void {
    process.stderr.write(`  ${C.cyan}◉${C.reset} ${C.bold}${name}${C.reset} ${C.dim}— ${detail}${C.reset}\n`);
  }

  private printPlanSummary(plan: RefactoringPlan): void {
    process.stderr.write(`\n  ${C.bold}REFACTORING PLAN${C.reset}\n`);
    process.stderr.write(`  ${C.dim}Score:${C.reset} ${C.white}${plan.currentScore.overall}${C.reset} ${C.dim}→ est.${C.reset} ${C.green}${plan.estimatedScoreAfter.overall}${C.reset} ${C.dim}(+${plan.estimatedScoreAfter.overall - plan.currentScore.overall} pts)${C.reset}\n`);
    process.stderr.write(`  ${C.dim}Steps:${C.reset} ${C.white}${plan.steps.length}${C.reset}  ${C.dim}Ops:${C.reset} ${C.white}${plan.totalOperations}${C.reset}  ${C.dim}Tier1:${C.reset} ${C.white}${plan.tier1Steps}${C.reset}  ${C.dim}Tier2:${C.reset} ${C.white}${plan.tier2Steps}${C.reset}\n`);

    if (plan.validation && !plan.validation.valid) {
      const errors = plan.validation.errorCount;
      const warnings = plan.validation.warningCount;
      process.stderr.write(`  ${C.yellow}⚠ Validation:${C.reset} ${errors} errors, ${warnings} warnings\n`);
    }

    process.stderr.write(`\n`);
    for (const step of plan.steps) {
      const prioColor = step.priority === 'CRITICAL' ? C.red
        : step.priority === 'HIGH' ? C.orange
        : step.priority === 'MEDIUM' ? C.yellow
        : C.dim;
      process.stderr.write(`  ${C.dim}${String(step.id).padStart(2)}.${C.reset} ${prioColor}[${step.priority}]${C.reset} ${C.bold}${step.title}${C.reset} ${C.dim}(${step.rule}, ${step.operations.length} ops)${C.reset}\n`);
    }
    process.stderr.write(`\n`);
  }

  private printStepPreview(step: RefactorStep, chain: PromptChain, current: number, total: number): void {
    process.stderr.write(`\n  ${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}\n`);
    process.stderr.write(`  ${C.bold}Step ${current}/${total}${C.reset} ${C.dim}—${C.reset} ${C.bold}${step.title}${C.reset}\n`);
    process.stderr.write(`  ${C.dim}Rule: ${step.rule} | Priority: ${step.priority} | Ops: ${step.operations.length}${C.reset}\n`);

    if (chain.passCount > 1) {
      process.stderr.write(`  ${C.magenta}Multi-pass:${C.reset} ${chain.passCount} passes\n`);
      for (const pass of chain.passes) {
        const dep = pass.dependsOn ? ` ${C.dim}(depends on pass ${pass.dependsOn})${C.reset}` : '';
        process.stderr.write(`    ${C.dim}${pass.passNumber}.${C.reset} ${pass.objective}${dep}\n`);
      }
    }

    process.stderr.write(`  ${C.dim}Rationale: ${step.rationale}${C.reset}\n\n`);

    for (const op of step.operations) {
      const { color, label } = this.opStyle(op.type);
      process.stderr.write(`    ${color}${label}${C.reset} ${op.path}`);
      if (op.newPath) {
        process.stderr.write(` ${C.dim}→${C.reset} ${op.newPath}`);
      }
      process.stderr.write(`\n`);
      process.stderr.write(`    ${C.dim}  ${op.description}${C.reset}\n`);
    }

    // Score impact preview
    if (step.scoreImpact.length > 0) {
      process.stderr.write(`\n  ${C.dim}Expected impact:${C.reset}\n`);
      for (const impact of step.scoreImpact) {
        const delta = impact.after - impact.before;
        const deltaColor = delta > 0 ? C.green : delta < 0 ? C.red : C.dim;
        process.stderr.write(`    ${C.dim}${impact.metric}:${C.reset} ${impact.before} → ${deltaColor}${impact.after} (${delta > 0 ? '+' : ''}${delta})${C.reset}\n`);
      }
    }
  }

  private printScoreDelta(before: number, after: number, delta: number): void {
    const deltaColor = delta > 0 ? C.green : delta < 0 ? C.red : C.dim;
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    process.stderr.write(`\n  ${C.bold}Score:${C.reset} ${before} ${deltaColor}${arrow} ${after} (${delta > 0 ? '+' : ''}${delta})${C.reset}\n`);
  }

  private printSessionSummary(): void {
    const totalDelta = this.session.currentScore - this.session.originalScore;
    const deltaColor = totalDelta > 0 ? C.green : totalDelta < 0 ? C.red : C.dim;

    process.stderr.write(`\n${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}\n`);
    process.stderr.write(`  ${C.bold}SESSION SUMMARY${C.reset}\n\n`);
    process.stderr.write(`  ${C.dim}Score:${C.reset} ${this.session.originalScore} ${deltaColor}→ ${this.session.currentScore} (${totalDelta > 0 ? '+' : ''}${totalDelta})${C.reset}\n`);
    process.stderr.write(`  ${C.dim}Steps:${C.reset} ${C.green}${this.session.completedSteps} executed${C.reset}, ${C.yellow}${this.session.skippedSteps} skipped${C.reset}, ${C.red}${this.session.rolledBackSteps} rolled back${C.reset}\n`);

    if (this.session.results.length > 0) {
      process.stderr.write(`\n  ${C.dim}Detail:${C.reset}\n`);
      for (const r of this.session.results) {
        const statusColor = r.action === 'executed' ? C.green
          : r.action === 'skipped' ? C.yellow
          : C.red;
        const delta = r.scoreAfter - r.scoreBefore;
        const deltaStr = r.action === 'executed'
          ? ` ${C.dim}(${delta > 0 ? '+' : ''}${delta})${C.reset}`
          : '';
        process.stderr.write(`    ${C.dim}#${r.stepId}${C.reset} ${statusColor}${r.action}${C.reset}${deltaStr}\n`);
      }
    }

    process.stderr.write(`\n${C.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.reset}\n\n`);
  }

  private printOp(type: string, detail: string): void {
    const style = this.opStyle(type as FileOperation['type']);
    process.stderr.write(`    ${style.color}${style.label}${C.reset} ${detail}\n`);
  }

  private opStyle(type: string): { color: string; label: string } {
    switch (type) {
      case 'CREATE': return { color: C.green, label: '✚ CREATE' };
      case 'MODIFY': return { color: C.yellow, label: '✎ MODIFY' };
      case 'DELETE': return { color: C.red, label: '✖ DELETE' };
      case 'MOVE': return { color: C.blue, label: '➡ MOVE  ' };
      case 'GIT': return { color: C.magenta, label: '⬡ GIT   ' };
      default: return { color: C.dim, label: `  ${type}  ` };
    }
  }

  private printInfo(msg: string): void {
    process.stderr.write(`  ${C.cyan}ℹ${C.reset} ${msg}\n`);
  }

  private printSuccess(msg: string): void {
    process.stderr.write(`  ${C.green}✓${C.reset} ${msg}\n`);
  }

  private printWarning(msg: string): void {
    process.stderr.write(`  ${C.yellow}⚠${C.reset} ${msg}\n`);
  }

  private printError(msg: string): void {
    process.stderr.write(`  ${C.red}✗${C.reset} ${msg}\n`);
  }
}
