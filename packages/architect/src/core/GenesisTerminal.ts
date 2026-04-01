import { select, confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import ora from 'ora';
import { Architect, ProgressEvent } from './architect.js';
import { AgentExecutor } from '@girardelli/architect-agents/src/core/agent-runtime/executor.js';
import { ProgressReporter, c } from '../adapters/progress-logger.js';
import { HtmlReportGenerator } from '../adapters/html-reporter.js';
import * as fs from 'fs';
import { execSync } from 'child_process';

export class GenesisTerminal {
  private architect: Architect;

  constructor(architect: Architect) {
    this.architect = architect;
  }

  public async start() {
    console.clear();
    console.log(chalk.cyan.bold('\nWelcome to Architect Genesis v8.0'));
    console.log(chalk.gray('The Autonomous Architecture Intent Compiler\n'));

    let active = true;
    while (active) {
      const action = await select({
        message: 'What would you like to build today?',
        choices: [
          {
            name: '🛡️  Scan Security & Anti-Pattern Boundaries',
            value: 'scan',
            description: 'Runs an O(N²) Matrix Analysis on your Codebase',
          },
          {
            name: '🛠️  Refactor System Anti-Patterns (God Mode)',
            value: 'refactor',
            description: 'Let AI Autonomous Agents rewrite your technical debt',
          },
          {
            name: '🏗️  Architect a New Technical Feature',
            value: 'feature',
            description: 'Build a new cross-layer feature dynamically',
          },
          {
            name: '✅ Validate Architecture & PR Deltas',
            value: 'validate',
            description: 'Check architecture rules and PR diffs against standards',
          },
          {
            name: '🚪 Exit',
            value: 'exit',
            description: 'Return to orbit',
          }
        ],
      });

      switch (action) {
        case 'scan':
          await this.runScan();
          break;
        case 'refactor':
          await this.runAutonomousRefactor();
          break;
        case 'feature':
          console.log(chalk.yellow('\nFeature architecture mode is coming in Phase 7.0!'));
          break;
        case 'validate':
          console.log(chalk.cyan('\n[System] Invoking Rules Engine...'));
          console.log(chalk.gray('> architect check'));
          try {
            execSync('node dist/src/adapters/cli.js check', { stdio: 'inherit' });
          } catch(e) {
            // Error is handled by inheritance
          }
          break;
        case 'exit':
          console.log(chalk.gray('\nGoodbye! Closing Genesis terminal.'));
          active = false;
          break;
      }
      
      if (active) {
        console.log('\n' + chalk.gray('──────────────────────────────────────────────────') + '\n');
      }
    }
  }

  private async runScan() {
    console.log(chalk.cyan('\n[System] Initiating Core Architectural Scan...'));
    const progress = new ProgressReporter();
    progress.printHeader('.');

    try {
      // Run deep analysis with full visual progress
      const report = await this.architect.analyze('.', (e: ProgressEvent) => progress.onProgress(e));
      
      // Compute score strictly for the final summary panel
      const score = report.score;
      
      // Extra Phase: Visual Report Generation
      progress.printExtraPhase('HTML ENGINE', 'Compiling interactive matrices', c.magenta);
      const htmlGenerator = new HtmlReportGenerator();
      
      // We generate the refactoring plan & agent specs statically for the report (without executing them)
      const plan = this.architect.refactor(report, '.');
      const suggestion = this.architect.suggestAgents(report, plan, '.');
      
      const htmlOutput = htmlGenerator.generateHtml(report, plan, suggestion);
      const htmlPath = `${process.cwd()}/architect-report-genesis.html`;
      
      fs.writeFileSync(htmlPath, htmlOutput);
      
      progress.printExtraComplete(`Saved 3D Interactive Report to: ${chalk.cyan('architect-report-genesis.html')}`);

      progress.printSummary(score.overall, score.breakdown, {
        files: report.projectInfo.totalFiles,
        lines: report.projectInfo.totalLines,
        antiPatterns: report.antiPatterns.length
      });
      
      console.log(chalk.green(`\n🚀 Done! Opening ${chalk.bold.cyan(htmlPath)} in your browser to see the graphics!`));
      try {
        execSync(`open "${htmlPath}"`);
      } catch (err) {
        console.error(chalk.yellow(`Could not automatically open browser. Please open ${htmlPath} manually.`));
      }

      // ── Post-Scan Autonomous Trigger ──
      const autoRun = await confirm({
        message: chalk.yellow(`\n⚠️ I have generated the O(N²) Matrix and found ${plan.steps.length} Refactoring Steps. Shall I take control of your IDE and autonomously execute this plan?`),
        default: false
      });

      if (autoRun) {
        await this.runAutonomousExecution(plan);
      }

    } catch (e: any) {
      console.error(chalk.red(`\n❌ Analysis Failed: ${e.message}`));
    }
  }

  private async runAutonomousRefactor() {
    console.log(chalk.cyan('\n[System] Running Quick Scan before Refactoring...'));
    try {
      const report = await this.architect.analyze('.');
      const plan = this.architect.refactor(report, '.');
      await this.runAutonomousExecution(plan);
    } catch (e: any) {
      console.error(chalk.red(`\n❌ Scan Failed: ${e.message}`));
    }
  }

  private async runAutonomousExecution(plan: any) {
    console.log(chalk.blue('\n[System] Initializing AgentExecutor Runtime...'));
    
    // Confirm Action
    const isDangerous = await confirm({
      message: chalk.red('WARNING: God Mode will rewrite files across your layers! Proceed?'),
      default: false
    });

    if (!isDangerous) {
      console.log(chalk.yellow('Refactor Aborted. Returning to orbit.'));
      return;
    }

    const spinner = ora('Engaging Autonomous Refactoring Protocol...').start();

    try {
      const executor = new AgentExecutor(isDangerous);

      spinner.succeed(chalk.green('Refactor Protocol Engaged!'));
      await executor.executePlan(plan);
      
      console.log(chalk.gray('Check your `git diff` to review the Agent changes before committing.'));
      
    } catch (error: any) {
      spinner.fail(`Agent Execution encountered an error: ${error.message}`);
      // Only prompt about variables if Anthropic/OpenAI was chosen in the plan
    }
  }
}
