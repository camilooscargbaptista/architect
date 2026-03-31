import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { RefactorStep, FileOperation } from '../types/rules.js';

export class HumanGate {
  private rl: readline.Interface | null = null;
  private autoMode: boolean;

  constructor(autoMode: boolean = false) {
    this.autoMode = autoMode;
  }

  /**
   * Request manual approval before applying a refactoring step.
   * If autoMode is true, it always auto-approves.
   */
  async requestApproval(step: RefactorStep): Promise<boolean> {
    console.log(`\n\x1b[36m[Architect Agent]\x1b[0m Evaluating Refactor Step \x1b[33m#${step.id}: ${step.title}\x1b[0m`);
    console.log(`\x1b[90mRationale: ${step.rationale}\x1b[0m\n`);
    
    for (const op of step.operations) {
      this.printOperation(op, !!step.aiPrompt);
    }
    
    if (this.autoMode) {
      console.log(`\n\x1b[32m[Auto-Mode Enabled]\x1b[0m Automatically applying changes...`);
      return true;
    }

    if (!this.rl) {
      this.rl = readline.createInterface({ input, output });
    }

    const answer = await this.rl.question(`\n⚠️  Do you approve executing these structural changes? [y/N]: `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }

  /**
   * Prints the planned operation visually
   */
  private printOperation(op: FileOperation, hasAiPrompt: boolean) {
    let color = '';
    let label = '';
    
    switch(op.type) {
      case 'CREATE': color = '\x1b[32m'; label = '✚ CREATE'; break; // Green
      case 'MODIFY': color = '\x1b[33m'; label = '✎ MODIFY'; break; // Yellow
      case 'DELETE': color = '\x1b[31m'; label = '✖ DELETE'; break; // Red
      case 'MOVE':   color = '\x1b[34m'; label = '➡ MOVE  '; break; // Blue
    }
    
    console.log(`  ${color}${label}\x1b[0m ${op.path}`);
    if (op.newPath) {
      console.log(`    \x1b[90m↳ Target: ${op.newPath}\x1b[0m`);
    }
    console.log(`    \x1b[90mDetails: ${op.description}\x1b[0m`);
    if (hasAiPrompt && op.type === 'MODIFY') {
      console.log(`    \x1b[35m✨ AI Operation:\x1b[0m Requires LLM Execution.`);
    }
  }

  close() {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }
}
