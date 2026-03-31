import { writeFileSync, mkdirSync, readFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { dirname } from 'path';
import { execSync } from 'child_process';
import { RefactoringPlan, RefactorStep, FileOperation } from '../types/rules.js';
import { HumanGate } from './human-gate.js';
import { ModelProviderFactory } from './ai-provider.js';

export class AgentExecutor {
  private gate: HumanGate;
    // @ts-ignore - Audit cleanup unused variable
  private autoMode: boolean;

  constructor(autoMode: boolean = false) {
    this.autoMode = autoMode;
    this.gate = new HumanGate(autoMode);
  }

  /**
   * Main entrypoint for Agent Runtime.
   */
  async executePlan(plan: RefactoringPlan) {
    console.log(`\n\x1b[35m=== 🤖 Architect Autonomous Agent ===\x1b[0m`);
    console.log(`Loaded Refactoring Plan: ${plan.steps.length} procedural steps.\n`);

    // 1. Mandatory Git Flow Branching
    this.ensureProtectiveBranch();

    // 2. Load AI Provider if needed
    const needsAI = plan.steps.some((s) => !!s.aiPrompt);
    let aiProvider = null;
    if (needsAI) {
      try {
        aiProvider = ModelProviderFactory.createProvider();
        console.log(`\x1b[32m[AI Engine Ready]\x1b[0m Linked to external LLM provider.\n`);
      } catch (e: any) {
        console.warn(`\x1b[33m[AI Warning]\x1b[0m Could not connect AI Provider (` + e.message + `). Steps requiring AI will be skipped.\n`);
      }
    }

    // 3. Execution Loop
    for (const step of plan.steps) {
      const approved = await this.gate.requestApproval(step);
      
      if (!approved) {
        console.log(`\x1b[90mSkipping step #${step.id}...\x1b[0m\n`);
        continue;
      }

      console.log(`\n\x1b[36mExecuting Step #${step.id}...\x1b[0m`);
      let successCount = 0;

      for (const op of step.operations) {
        try {
          await this.executeOperation(op, step.aiPrompt, aiProvider);
          successCount++;
        } catch (e: any) {
          console.error(`\x1b[31mFailed to execute operation on ${op.path}:\x1b[0m ${e.message}`);
        }
      }

      // 4. Atomic Commit per Step
      if (successCount > 0) {
        this.commitStep(step);
      }
    }

    this.gate.close();
    console.log(`\n\x1b[32m=== ✅ Autonomous Execution Complete ===\x1b[0m`);
    console.log(`Changes are safed in the current feature branch. Review, test, and push to remote!`);
  }

  private async executeOperation(op: FileOperation, aiPrompt?: string, aiProvider?: any) {
    const targetPath = op.path;

    if (op.type === 'CREATE') {
      if (op.content) {
        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, op.content, 'utf8');
        console.log(`  \x1b[32m✔ Created:\x1b[0m ${targetPath}`);
      }
    } 
    else if (op.type === 'MOVE' && op.newPath) {
      if (existsSync(targetPath)) {
        mkdirSync(dirname(op.newPath), { recursive: true });
        renameSync(targetPath, op.newPath);
        console.log(`  \x1b[34m✔ Moved:\x1b[0m ${targetPath} -> ${op.newPath}`);
      }
    }
    else if (op.type === 'DELETE') {
      if (existsSync(targetPath)) {
        unlinkSync(targetPath);
        console.log(`  \x1b[31m✔ Deleted:\x1b[0m ${targetPath}`);
      }
    }
    else if (op.type === 'MODIFY') {
      if (!existsSync(targetPath)) {
        throw new Error(`Target file ${targetPath} does not exist`);
      }

      const currentContent = readFileSync(targetPath, 'utf8');

      if (aiPrompt) {
        if (!aiProvider) throw new Error('AI Provider not configured, cannot execute prompt');
        console.log(`  \x1b[35m✨ AI Generating structure for ${targetPath}...\x1b[0m`);
        
        const newContent = await aiProvider.executeRefactoringPrompt(currentContent, aiPrompt);
        writeFileSync(targetPath, newContent, 'utf8');
        console.log(`  \x1b[33m✔ AI Re-wrote:\x1b[0m ${targetPath}`);
      } else if (op.content) {
        // Fallback or exact replacement
        writeFileSync(targetPath, op.content, 'utf8');
        console.log(`  \x1b[33m✔ Modified:\x1b[0m ${targetPath}`);
      }
    }
  }

  private ensureProtectiveBranch() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
      const needsNewBranch = ['main', 'master', 'develop'].includes(currentBranch);

      if (needsNewBranch) {
        const ts = new Date().getTime();
        const branchName = `feature/architect-refactor-${ts}`;
        console.log(`\x1b[36m[Git Flow]\x1b[0m Currently on '${currentBranch}'. Creating protective branch \x1b[33m${branchName}\x1b[0m...`);
        execSync(`git checkout -b ${branchName}`);
      } else {
        console.log(`\x1b[32m[Git Flow]\x1b[0m Continuing firmly on non-base branch '${currentBranch}'.`);
      }
    } catch (e) {
      console.warn(`\x1b[33m[Warning]\x1b[0m Git repository not detected or git command failed. Proceeding without branch protection.`);
    }
  }

  private commitStep(step: RefactorStep) {
    if (process.env.NODE_ENV === 'test') return;
    try {
      execSync('git add .');
      const msg = `refactor(architect): apply rule ${step.rule}\n\nAuto-applied by Architect Agent.\nMotivation: ${step.title}`;
      execSync(`git commit -m "${msg}"`);
      console.log(`  \x1b[32m✔ Git Commit Saved: ${step.rule}\x1b[0m\n`);
    } catch (e) {
      // Might happen if there were no actual changes (e.g. content was identical)
      console.log(`  \x1b[90m(No git changes detected for this step)\x1b[0m\n`);
    }
  }
}
