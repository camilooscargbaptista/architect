#!/usr/bin/env node

/**
 * Architect CLI v8.1
 * Enterprise Architecture Analysis — @girardelli/architect
 *
 * Uso:
 *   npx architect analyze ./src
 *   npx architect analyze ./src --format html --output report.html
 *   npx architect diagram ./src
 *   npx architect score ./src
 *   npx architect anti-patterns ./src
 */

import { architect, ProgressEvent } from '../core/architect.js';
import { GenesisTerminal } from '../core/GenesisTerminal.js';
import { c, ProgressReporter } from './progress-logger.js';
import { AgentExecutor } from '@girardelli/architect-agents/src/core/agent-runtime/executor.js';
import { InteractiveRefactor } from '../core/interactive-refactor.js';
import { ForecastV2Engine } from '@girardelli/architect-core/src/core/analyzers/forecast-v2.js';
import { GitHistoryAnalyzer } from '@girardelli/architect-core/src/infrastructure/git-history.js';
import { TemporalScorer } from '@girardelli/architect-core/src/core/analyzers/temporal-scorer.js';
import { PluginRegistry } from '@girardelli/architect-core/src/core/plugin-registry.js';
import { ReportGenerator } from './reporter.js';
import { HtmlReportGenerator } from './html-reporter.js';
import { RefactorReportGenerator } from './refactor-reporter.js';
import { writeFileSync, existsSync,  readFileSync } from 'fs';
import { resolve, basename,  join } from 'path';
import { logger } from '@girardelli/architect-core/src/infrastructure/logger.js';
import { i18n } from '@girardelli/architect-core/src/core/i18n.js';
import { KnowledgeBase } from '@girardelli/architect-core/src/core/knowledge-base/index.js';
import * as yaml from 'yaml';
import chokidar from 'chokidar';
import { ArchitectRules, ValidationResult } from '@girardelli/architect-core/src/core/types/architect-rules.js';
import { RulesEngine } from '@girardelli/architect-core/src/core/rules-engine.js';
import { execSync } from 'child_process';
import { GithubActionAdapter } from './github-action.js';
import * as github from '@actions/github';

type OutputFormat = 'json' | 'markdown' | 'html';

interface CliOptions {
  command: string;
  path: string;
  format: OutputFormat;
  output: string | undefined;
  verbose: boolean;
  locale: string;
  watch: boolean;
  auto: boolean;
  interactive: boolean;
}



// ── CLI Parsing ──



function parseArgs(args: string[]): CliOptions {
  const command = args[0] || 'analyze';
  const pathArg = args.find((a) => !a.startsWith('--') && a !== command) || '.';
  const formatIdx = args.indexOf('--format');
  const format = (formatIdx >= 0 ? args[formatIdx + 1] : 'html') as OutputFormat;
  const outputIdx = args.indexOf('--output');
  const output = outputIdx >= 0 ? args[outputIdx + 1] : undefined;
  const verbose = args.includes('--verbose') || args.includes('-v');

  const localeIdx = args.indexOf('--locale');
  let locale: string = 'en'; // default
  if (localeIdx >= 0 && args[localeIdx + 1]) {
    locale = args[localeIdx + 1]!;
  } else {
    // Attempt detect via ENV
    const envLang = process.env['LANG'] || process.env['LANGUAGE'] || '';
    if (envLang.toLowerCase().includes('pt')) {
      locale = 'pt-BR';
    }
  }

  const watch = args.includes('--watch') || args.includes('-w');
  const auto = args.includes('--auto');
  const interactive = args.includes('--interactive') || args.includes('-i');

  return { command, path: resolve(pathArg), format, output: output || undefined, verbose, locale, watch, auto, interactive };
}

function printUsage(): void {
  console.log(`
${c.cyan}${c.bold}⚡ Architect Agent v7.0${c.reset} — Enterprise Architecture Intelligence

${c.bold}Usage:${c.reset}
  architect <command> [path] [options]

${c.bold}Commands:${c.reset}
  ${c.cyan}analyze${c.reset}         Full architecture analysis (default)
  ${c.cyan}genesis${c.reset}         [NEW] Interactive God Mode Terminal (TUI)
  ${c.cyan}execute${c.reset}         Autonomous Agent Runtime - auto-refactor project
  ${c.cyan}check${c.reset}           Run architecture-as-code validation against .architect.rules.yml
  ${c.cyan}pr-review${c.reset}       Run in GitHub Actions to comment on PRs with Score Delta
  ${c.cyan}refactor${c.reset}        Generate refactoring plan (use --interactive for guided mode)
  ${c.cyan}forecast${c.reset}        Predict architecture score decay using ML regression
  ${c.cyan}plugin${c.reset}          Manage plugins (install, list, search, remove)
  ${c.cyan}kb${c.reset}              Knowledge Base — history, trends, export, LLM context
  ${c.cyan}agents${c.reset}          Generate/audit .agent/ directory with AI agents
  ${c.cyan}diagram${c.reset}         Generate architecture diagram only
  ${c.cyan}score${c.reset}           Calculate quality score only
  ${c.cyan}anti-patterns${c.reset}   Detect anti-patterns only
  ${c.cyan}layers${c.reset}          Analyze layer structure only

${c.bold}Options:${c.reset}
  --format <type>   Output format: html, json, markdown (default: html)
  --output <file>   Output file path
  --locale <lang>   Language (en or pt-BR)
  --verbose, -v     Enable verbose debug logging
  --watch, -w       Watch mode (re-run check on file changes)
  --auto            Agent YOLO Mode - auto-approve structural changes
  --interactive, -i Interactive refactoring: step-by-step with re-analysis
  --help            Show this help message

${c.bold}Examples:${c.reset}
  ${c.dim}$${c.reset} architect execute ./src
  ${c.dim}$${c.reset} architect execute ./src --auto
  ${c.dim}$${c.reset} architect refactor ./src --interactive
  ${c.dim}$${c.reset} architect forecast ./src
  ${c.dim}$${c.reset} architect analyze ./src --format html --output report.html

${c.dim}@girardelli/architect — Girardelli Tecnologia${c.reset}
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);
  logger.setup({ verbose: options.verbose, json: options.format === 'json' });
  
  // Set global locale
  i18n.setLocale(options.locale as 'en' | 'pt-BR');

  try {
    switch (options.command) {
      case 'genesis': {
        const terminal = new GenesisTerminal(architect);
        await terminal.start();
        break;
      }

      case 'analyze': {
        const progress = new ProgressReporter();
        progress.printHeader(options.path);

        const report = await architect.analyze(options.path, (e: ProgressEvent) => progress.onProgress(e));

        // Refactoring
        progress.printExtraPhase('REFACTOR ENGINE', 'Building refactoring plan', c.orange);
        const plan = architect.refactor(report, options.path);
        progress.printExtraComplete(
          `${c.white}${plan.steps.length}${c.reset}${c.dim} steps · ${c.reset}${c.white}${plan.totalOperations}${c.reset}${c.dim} operations · est. +${plan.estimatedScoreAfter.overall - plan.currentScore.overall} pts${c.reset}`
        );

        // Agent suggestion
        progress.printExtraPhase('AGENT SYSTEM', 'Analyzing agent requirements', c.magenta);
        const agentSuggestion = architect.suggestAgents(report, plan, options.path);
        progress.printExtraComplete(
          `${c.white}${agentSuggestion.suggestedAgents.length}${c.reset}${c.dim} agents suggested${agentSuggestion.hasExistingAgents ? ' (existing .agent/ audited)' : ''}${c.reset}`
        );

        const projectName = String(report.projectInfo.name || basename(options.path)).replace(/[^a-zA-Z0-9-]/g, '-');

        // Report generation
        if (options.format === 'html') {
          progress.printExtraPhase('REPORT BUILDER', 'Generating interactive HTML report', c.cyan);
          const htmlGenerator = new HtmlReportGenerator();
          const html = htmlGenerator.generateHtml(report, plan, agentSuggestion);
          const outputPath = options.output || `architect-report-${projectName}.html`;
          writeFileSync(outputPath, html);
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        } else if (options.format === 'markdown') {
          progress.printExtraPhase('REPORT BUILDER', 'Generating Markdown report', c.cyan);
          const mdGenerator = new ReportGenerator();
          const markdown = mdGenerator.generateMarkdownReport(report);
          const outputPath = options.output || `architect-report-${projectName}.md`;
          writeFileSync(outputPath, markdown);
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        } else {
          progress.printExtraPhase('REPORT BUILDER', 'Generating JSON report', c.cyan);
          const outputPath = options.output || `architect-report-${projectName}.json`;
          writeFileSync(outputPath, JSON.stringify({ report, plan, agentSuggestion }, null, 2));
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        }

        // Knowledge Base persistence
        try {
          progress.printExtraPhase('KNOWLEDGE BASE', 'Persisting analysis to KB', c.cyan);
          const kb = new KnowledgeBase(options.path);
          const analysisId = kb.persistAnalysis(report);
          const stats = kb.getStats();
          const delta = kb.getScoreDelta(kb.getProjectByPath(report.projectInfo.path)?.id ?? 0);
          const deltaStr = delta
            ? ` · ${delta.delta >= 0 ? '+' : ''}${delta.delta.toFixed(1)} pts since last`
            : ' · first analysis';
          progress.printExtraComplete(
            `${c.white}#${analysisId}${c.reset}${c.dim} saved · ${stats.totalAnalyses} total analyses${deltaStr}${c.reset}`
          );
          kb.close();
        } catch (kbErr: any) {
          progress.printExtraComplete(`${c.dim}KB skipped: ${kbErr.message}${c.reset}`);
        }

        // Summary
        progress.printSummary(report.score.overall, report.score.breakdown, {
          files: report.projectInfo.totalFiles,
          lines: report.projectInfo.totalLines,
          antiPatterns: report.antiPatterns.length,
          refactorSteps: plan.steps.length,
          refactorOps: plan.totalOperations,
          agents: agentSuggestion.suggestedAgents.length,
        });
        break;
      }

      case 'refactor': {
        // ── Interactive mode (Fase 3.3) ──
        if (options.interactive) {
          const interactive = new InteractiveRefactor({
            projectPath: options.path,
            autoMode: options.auto,
          });
          await interactive.run();
          break;
        }

        // ── Standard refactor plan generation ──
        const progress = new ProgressReporter();
        progress.printHeader(options.path);

        const report = await architect.analyze(options.path, (e: ProgressEvent) => progress.onProgress(e));

        progress.printExtraPhase('REFACTOR ENGINE', 'Building refactoring plan', c.orange);
        const plan = architect.refactor(report, options.path);
        const projectName = String(report.projectInfo.name || basename(options.path)).replace(/[^a-zA-Z0-9-]/g, '-');

        if (options.format === 'json') {
          const outputPath = options.output || `refactor-plan-${projectName}.json`;
          writeFileSync(outputPath, JSON.stringify(plan, null, 2));
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        } else {
          const refactorReporter = new RefactorReportGenerator();
          const html = refactorReporter.generateHtml(plan);
          const outputPath = options.output || `refactor-plan-${projectName}.html`;
          writeFileSync(outputPath, html);
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        }

        process.stderr.write(`\n  ${c.bold}REFACTORING PLAN${c.reset}\n`);
        process.stderr.write(`  ${c.dim}Steps:${c.reset} ${c.white}${plan.steps.length}${c.reset}  ${c.dim}Ops:${c.reset} ${c.white}${plan.totalOperations}${c.reset}  ${c.dim}Tier1:${c.reset} ${c.white}${plan.tier1Steps}${c.reset}  ${c.dim}Tier2:${c.reset} ${c.white}${plan.tier2Steps}${c.reset}\n`);
        process.stderr.write(`  ${c.dim}Score:${c.reset} ${c.white}${plan.currentScore.overall}${c.reset}${c.dim} → ${c.reset}${c.green}${plan.estimatedScoreAfter.overall}${c.reset} ${c.dim}(+${plan.estimatedScoreAfter.overall - plan.currentScore.overall})${c.reset}\n\n`);
        break;
      }

      case 'check': {
        const rulesPath = join(options.path, '.architect.rules.yml');

        const executeCheck = async (): Promise<boolean> => {
          if (!existsSync(rulesPath)) {
            logger.error(`Rules file not found at: ${rulesPath}`);
            logger.error(`Create a '.architect.rules.yml' file to use the 'check' command.`);
            return false;
          }

          let rules: ArchitectRules;
          try {
            const raw = readFileSync(rulesPath, 'utf8');
            rules = yaml.parse(raw) as ArchitectRules;
          } catch (e: any) {
            logger.error(`Failed to parse ${rulesPath}: ${e.message}`);
            return false;
          }

          process.stderr.write(`\n  ${c.cyan}◉${c.reset} ${c.bold}RULES ENGINE${c.reset} ${c.dim}— Validating against .architect.rules.yml...${c.reset}\n`);

          const report = await architect.analyze(options.path);
          const engine = new RulesEngine();
          const result = engine.validate(report, rules);

          if (result.violations.length === 0) {
            process.stderr.write(`\n  ${c.green}✓ All quality gates and boundaries passed!${c.reset} ${c.dim}(Score: ${report.score.overall}/100)${c.reset}\n\n`);
            return true;
          }

          process.stderr.write(`\n  ${c.red}✗ Architecture validation failed!${c.reset} ${c.dim}(Score: ${report.score.overall}/100)${c.reset}\n\n`);

          let errors = 0;
          let warnings = 0;

          for (const v of result.violations) {
            if (v.level === 'error') {
              errors++;
              process.stderr.write(`  ${c.red}[ERROR]${c.reset} ${c.bold}${v.rule}${c.reset}: ${v.message}\n`);
            } else {
              warnings++;
              process.stderr.write(`  ${c.yellow}[WARN]${c.reset} ${c.bold}${v.rule}${c.reset}: ${v.message}\n`);
            }
          }

          process.stderr.write(`\n  ${c.dim}Total: ${errors} errors, ${warnings} warnings.${c.reset}\n\n`);
          return result.success;
        };

        if (options.watch) {
          process.stderr.write(`\n  ${c.dim}👀 Watch mode enabled. Listening for changes in ${options.path}...${c.reset}\n`);
          
          await executeCheck();
          
          const watcher = chokidar.watch([
            join(options.path, '**/*.ts'),
            join(options.path, '**/*.js'),
            rulesPath
          ], {
            ignored: /(^|[\/\\])\../, // ignore dotfiles
            persistent: true,
            ignoreInitial: true,
          });

          watcher.on('all', async (_event, path) => {
            console.clear();
            process.stderr.write(`  ${c.dim}↻ File changed: ${basename(path)}. Re-running checks...${c.reset}\n`);
            await executeCheck();
          });
          
          // Keep process alive
          return new Promise(() => {});
        } else {
          const success = await executeCheck();
          if (!success) process.exit(1);
        }
        break;
      }

      case 'pr-review': {
        const githubToken = process.env['GITHUB_TOKEN'];
        if (!githubToken) {
          logger.error('GITHUB_TOKEN environment variable is required for pr-review');
          process.exit(1);
          return;
        }

        if (!github.context.payload.pull_request) {
          logger.error('Not running in a Pull Request context. Exiting.');
          process.exit(0);
          return;
        }

        process.stderr.write(`\n  ${c.cyan}◉${c.reset} ${c.bold}PR REVIEWER${c.reset} ${c.dim}— Analyzing HEAD vs BASE...${c.reset}\n`);

        const headReport = await architect.analyze(options.path);

        let baseReport = null;
        try {
          const baseRef = github.context.payload.pull_request['base']['ref'];
          process.stderr.write(`  ${c.dim}↳ Fetching and checking out base branch: ${baseRef}${c.reset}\n`);
          
          execSync(`git fetch origin ${baseRef} || true`, { stdio: 'ignore', cwd: options.path });
          const currentBranch = execSync(`git rev-parse --abbrev-ref HEAD`, { cwd: options.path }).toString().trim();
          execSync(`git checkout ${baseRef}`, { stdio: 'ignore', cwd: options.path });
          
          process.stderr.write(`  ${c.dim}↳ Analyzing base branch...${c.reset}\n`);
          baseReport = await architect.analyze(options.path);

          process.stderr.write(`  ${c.dim}↳ Reverting to original branch: ${currentBranch}${c.reset}\n`);
          execSync(`git checkout ${currentBranch}`, { stdio: 'ignore', cwd: options.path });
        } catch (e: any) {
          logger.error(`Failed to analyze base branch: ${e.message}`);
          process.stderr.write(`  ${c.yellow}⚠️ Falling back to single-scan (no delta)${c.reset}\n`);
          // Ensure we try to checkout back just in case
          try { execSync(`git checkout -`, { stdio: 'ignore', cwd: options.path }); } catch {}
        }

        let validationResult: ValidationResult | undefined;
        const rulesPath = join(options.path, '.architect.rules.yml');
        if (existsSync(rulesPath)) {
          process.stderr.write(`  ${c.dim}↳ Validating Architecture Rules...${c.reset}\n`);
          const raw = readFileSync(rulesPath, 'utf8');
          const rules = yaml.parse(raw) as ArchitectRules;
          const engine = new RulesEngine();
          validationResult = engine.validate(headReport, rules);
        }

        process.stderr.write(`  ${c.dim}↳ Posting comment to GitHub PR #${github.context.payload.pull_request.number}...${c.reset}\n`);
        const adapter = new GithubActionAdapter(githubToken);
        await adapter.postComment(headReport, baseReport, validationResult);
        
        process.stderr.write(`\n  ${c.green}✓ PR Comment successfully posted!${c.reset}\n\n`);

        if (validationResult && !validationResult.success) {
          process.stderr.write(`  ${c.red}✗ Architecture rules validation failed (Action blocked).${c.reset}\n\n`);
          process.exit(1);
        }
        break;
      }

      case 'forecast': {
        const progress = new ProgressReporter();
        progress.printHeader(options.path);

        // Phase 1: Analyze
        const fReport = await architect.analyze(options.path, (e: ProgressEvent) => progress.onProgress(e));

        // Phase 2: Git history
        progress.printExtraPhase('GIT HISTORY', 'Analyzing commit timeline', c.magenta);
        const gitAnalyzer = new GitHistoryAnalyzer();
        const gitReport = await gitAnalyzer.analyze(options.path);
        progress.printExtraComplete(
          `${c.white}${gitReport.totalCommits}${c.reset}${c.dim} commits · ${c.reset}${c.white}${gitReport.modules.length}${c.reset}${c.dim} modules · ${c.reset}${c.white}${gitReport.periodWeeks}${c.reset}${c.dim} weeks${c.reset}`
        );

        // Phase 3: Temporal scoring
        progress.printExtraPhase('TEMPORAL SCORER', 'Computing velocity-adjusted scores', c.orange);
        const scorer = new TemporalScorer();
        const staticScores = new Map<string, number>();
        for (const mod of gitReport.modules) {
          staticScores.set(mod.modulePath, fReport.score.overall);
        }
        const temporalReport = scorer.score(gitReport, staticScores);
        progress.printExtraComplete(
          `${c.white}${temporalReport.overallTrend}${c.reset}${c.dim} · temporal score: ${c.reset}${c.white}${temporalReport.overallTemporalScore}${c.reset}`
        );

        // Phase 4: Forecast V2
        progress.printExtraPhase('FORECAST V2', 'Running ML-based decay prediction', c.cyan);
        const forecastEngine = new ForecastV2Engine();
        const forecastResult = forecastEngine.predict(fReport, gitReport, temporalReport);
        progress.printExtraComplete(`${c.white}${forecastResult.overallRisk}${c.reset}${c.dim} risk · ${c.reset}${c.white}${forecastResult.atRiskModules.length}${c.reset}${c.dim} modules at risk${c.reset}`);

        // Output
        if (options.format === 'json') {
          const projectName = String(fReport.projectInfo.name || basename(options.path)).replace(/[^a-zA-Z0-9-]/g, '-');
          const outputPath = options.output || `forecast-${projectName}.json`;
          writeFileSync(outputPath, JSON.stringify(forecastResult, null, 2));
          process.stderr.write(`\n  ${c.green}✓${c.reset} Forecast saved: ${outputPath}\n\n`);
        } else {
          // Pretty print to terminal
          const fc = forecastResult.projectForecast;
          const riskColor = forecastResult.overallRisk === 'critical' ? c.red
            : forecastResult.overallRisk === 'high' ? c.orange
            : forecastResult.overallRisk === 'medium' ? c.yellow
            : c.green;

          process.stderr.write(`\n  ${c.bold}ARCHITECTURE FORECAST${c.reset}\n`);
          process.stderr.write(`  ${riskColor}${c.bold}${forecastResult.overallRisk.toUpperCase()} RISK${c.reset}\n\n`);
          process.stderr.write(`  ${forecastResult.headline}\n\n`);

          process.stderr.write(`  ${c.dim}Score:${c.reset} ${c.white}${Math.round(fc.currentScore)}${c.reset} ${c.dim}→${c.reset} `);
          const deltaColor = fc.scoreDelta < 0 ? c.red : fc.scoreDelta > 0 ? c.green : c.dim;
          process.stderr.write(`${deltaColor}${Math.round(fc.predictedScore)}${c.reset} ${c.dim}(${fc.scoreDelta > 0 ? '+' : ''}${fc.scoreDelta.toFixed(1)})${c.reset}\n`);
          process.stderr.write(`  ${c.dim}Weekly Δ:${c.reset} ${deltaColor}${fc.weeklyDelta > 0 ? '+' : ''}${fc.weeklyDelta.toFixed(2)}${c.reset}${c.dim}/week${c.reset}\n`);
          process.stderr.write(`  ${c.dim}R²:${c.reset} ${c.white}${fc.regression.rSquared}${c.reset}  ${c.dim}Confidence:${c.reset} ${c.white}${Math.round(fc.confidence * 100)}%${c.reset}\n`);

          if (fc.weeksToThreshold !== Infinity) {
            process.stderr.write(`  ${c.red}⚠ Critical threshold (${fc.threshold}) in ~${fc.weeksToThreshold} weeks${c.reset}\n`);
          }

          if (forecastResult.atRiskModules.length > 0) {
            process.stderr.write(`\n  ${c.bold}AT-RISK MODULES${c.reset}\n`);
            for (const mod of forecastResult.atRiskModules.slice(0, 5)) {
              const mColor = mod.riskLevel === 'critical' ? c.red : mod.riskLevel === 'high' ? c.orange : c.yellow;
              process.stderr.write(`  ${mColor}[${mod.riskLevel}]${c.reset} ${c.bold}${mod.modulePath}${c.reset} ${c.dim}(${mod.currentScore} → ${mod.predictedScore}, Δ${mod.weeklyDelta.toFixed(2)}/w)${c.reset}\n`);
              for (const driver of mod.drivers.slice(0, 2)) {
                process.stderr.write(`    ${c.dim}↳ ${driver}${c.reset}\n`);
              }
            }
          }

          if (forecastResult.recommendations.length > 0) {
            process.stderr.write(`\n  ${c.bold}RECOMMENDATIONS${c.reset}\n`);
            for (const rec of forecastResult.recommendations) {
              process.stderr.write(`  ${c.cyan}→${c.reset} ${rec}\n`);
            }
          }

          process.stderr.write(`\n`);
        }
        break;
      }

      case 'agents': {
        const progress = new ProgressReporter();
        progress.printHeader(options.path);

        const report = await architect.analyze(options.path, (e: ProgressEvent) => progress.onProgress(e));

        progress.printExtraPhase('REFACTOR ENGINE', 'Building refactoring plan', c.orange);
        const plan = architect.refactor(report, options.path);
        progress.printExtraComplete(`${c.white}${plan.steps.length}${c.reset}${c.dim} steps${c.reset}`);

        progress.printExtraPhase('AGENT GENERATOR', 'Generating .agent/ framework', c.magenta);
        const outputDir = options.output || undefined;
        const result = architect.agents(report, plan, options.path, outputDir);
        progress.printExtraComplete(`${c.white}${result.generated.length}${c.reset}${c.dim} files generated${c.reset}`);

        process.stderr.write(`\n  ${c.bold}🤖 AGENT SYSTEM${c.reset}\n\n`);

        if (result.generated.length > 0) {
          process.stderr.write(`  ${c.green}Generated:${c.reset}\n`);
          for (const file of result.generated) {
            process.stderr.write(`  ${c.dim}  📄${c.reset} ${file}\n`);
          }
        }

        if (result.audit.length > 0) {
          const missing = result.audit.filter(f => f.type === 'MISSING');
          const improvements = result.audit.filter(f => f.type === 'IMPROVEMENT');
          const ok = result.audit.filter(f => f.type === 'OK');

          if (ok.length > 0) process.stderr.write(`\n  ${c.green}✓ ${ok.length} checks passed${c.reset}\n`);
          if (missing.length > 0) {
            process.stderr.write(`\n  ${c.red}✗ ${missing.length} missing (auto-generated):${c.reset}\n`);
            for (const f of missing) process.stderr.write(`    ${c.dim}📄${c.reset} ${f.file} — ${f.description}\n`);
          }
          if (improvements.length > 0) {
            process.stderr.write(`\n  ${c.yellow}💡 ${improvements.length} improvements:${c.reset}\n`);
            for (const f of improvements) {
              process.stderr.write(`    ${c.dim}⚡${c.reset} ${f.description}\n`);
              if (f.suggestion) process.stderr.write(`      ${c.dim}→ ${f.suggestion}${c.reset}\n`);
            }
          }
        }
        process.stderr.write(`\n  ${c.dim}Score: ${report.score.overall}/100${c.reset}\n\n`);
        break;
      }

      case 'execute': {
        const progress = new ProgressReporter();
        progress.printHeader(options.path);

        const report = await architect.analyze(options.path, (e: ProgressEvent) => progress.onProgress(e));

        progress.printExtraPhase('REFACTOR ENGINE', 'Building automated refactoring plan', c.orange);
        const plan = architect.refactor(report, options.path);
        progress.printExtraComplete(`${c.white}${plan.steps.length}${c.reset}${c.dim} steps generated${c.reset}`);

        const executor = new AgentExecutor(options.auto);
        await executor.executePlan(plan);
        break;
      }

      case 'diagram': {
        const diagram = await architect.diagram(options.path);
        if (options.output) {
          writeFileSync(options.output, diagram);
          process.stderr.write(`  ${c.green}✓${c.reset} Diagram saved: ${options.output}\n`);
        } else {
          console.log(diagram);
        }
        break;
      }

      case 'score': {
        const score = await architect.score(options.path);
        if (options.format === 'json') {
          console.log(JSON.stringify(score, null, 2));
        } else {
          const scoreColor = score.overall >= 80 ? c.green : score.overall >= 60 ? c.yellow : c.red;
          process.stderr.write(`\n  ${c.bold}ARCHITECTURE SCORE${c.reset}\n`);
          process.stderr.write(`  ${scoreColor}${c.bold}${score.overall}/100${c.reset}\n\n`);
          for (const [name, value] of Object.entries(score.breakdown)) {
            process.stderr.write(`  ${c.dim}${name}:${c.reset} ${c.white}${value}${c.reset}\n`);
          }
          process.stderr.write('\n');
        }
        break;
      }

      case 'anti-patterns': {
        const patterns = await architect.antiPatterns(options.path);
        if (options.format === 'json') {
          console.log(JSON.stringify(patterns, null, 2));
        } else {
          process.stderr.write(`\n  ${c.bold}ANTI-PATTERNS${c.reset} — ${patterns.length} found\n\n`);
          for (const p of patterns) {
            const sevColor = p.severity === 'CRITICAL' ? c.red : p.severity === 'HIGH' ? c.orange : c.yellow;
            process.stderr.write(`  ${sevColor}[${p.severity}]${c.reset} ${c.bold}${p.name}${c.reset}: ${p.description}\n`);
          }
          process.stderr.write('\n');
        }
        break;
      }

      case 'layers': {
        const layers = await architect.layers(options.path);
        if (options.format === 'json') {
          console.log(JSON.stringify(layers, null, 2));
        } else {
          process.stderr.write(`\n  ${c.bold}ARCHITECTURE LAYERS${c.reset}\n\n`);
          for (const l of layers) {
            process.stderr.write(`  ${c.cyan}${l.name}${c.reset}: ${c.white}${l.files.length}${c.reset} files\n`);
          }
          process.stderr.write('\n');
        }
        break;
      }

      case 'plugin': {
        const registry = new PluginRegistry(options.path);
        registry.load();

        // Sub-commands: plugin install <spec>, plugin list, plugin search <query>, plugin remove <name>, plugin enable <name>, plugin disable <name>
        const subCommand = args[1] ?? 'list';
        const pluginArg = args[2] ?? '';

        switch (subCommand) {
          case 'install': {
            if (!pluginArg) {
              logger.error('Usage: architect plugin install <package-or-path>');
              process.exit(1);
              break;
            }

            process.stderr.write(`\n  ${c.cyan}◉${c.reset} ${c.bold}PLUGIN INSTALL${c.reset}\n`);

            let entry;
            if (pluginArg.startsWith('./') || pluginArg.startsWith('../') || pluginArg.startsWith('/')) {
              process.stderr.write(`  ${c.dim}Installing local plugin: ${pluginArg}${c.reset}\n`);
              entry = registry.installLocal(pluginArg);
            } else {
              process.stderr.write(`  ${c.dim}Installing from npm: ${pluginArg}${c.reset}\n`);
              entry = registry.installNpm(pluginArg);
            }

            process.stderr.write(`  ${c.green}✓${c.reset} Installed ${c.bold}${entry.name}${c.reset}@${entry.version} (${entry.source})\n\n`);
            break;
          }

          case 'list': {
            const plugins = registry.list();
            process.stderr.write(`\n  ${c.bold}INSTALLED PLUGINS${c.reset} — ${plugins.length} total\n\n`);

            if (plugins.length === 0) {
              process.stderr.write(`  ${c.dim}No plugins installed. Use 'architect plugin install <package>' to add one.${c.reset}\n\n`);
            } else {
              for (const p of plugins) {
                const statusIcon = p.enabled ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
                const hooks: string[] = [];
                if (p.manifest?.hooks.antiPatterns) hooks.push('anti-patterns');
                if (p.manifest?.hooks.refactorRules) hooks.push('refactor-rules');
                if (p.manifest?.hooks.scoreModifiers) hooks.push('score-modifiers');
                const hooksStr = hooks.length > 0 ? ` ${c.dim}[${hooks.join(', ')}]${c.reset}` : '';
                process.stderr.write(`  ${statusIcon} ${c.bold}${p.name}${c.reset}@${p.version} ${c.dim}(${p.source})${c.reset}${hooksStr}\n`);
              }
              process.stderr.write('\n');
            }
            break;
          }

          case 'search': {
            if (!pluginArg) {
              logger.error('Usage: architect plugin search <query>');
              process.exit(1);
              break;
            }

            process.stderr.write(`\n  ${c.bold}PLUGIN SEARCH${c.reset} — "${pluginArg}"\n\n`);
            const results = registry.searchNpm(pluginArg);

            if (results.length === 0) {
              process.stderr.write(`  ${c.dim}No plugins found matching "${pluginArg}".${c.reset}\n\n`);
            } else {
              for (const r of results.slice(0, 10)) {
                const installed = registry.has(r.name) ? ` ${c.green}[installed]${c.reset}` : '';
                process.stderr.write(`  ${c.bold}${r.name}${c.reset}@${r.version}${installed}\n`);
                if (r.description) {
                  process.stderr.write(`    ${c.dim}${r.description}${c.reset}\n`);
                }
              }
              process.stderr.write('\n');
            }
            break;
          }

          case 'remove': {
            if (!pluginArg) {
              logger.error('Usage: architect plugin remove <name>');
              process.exit(1);
              break;
            }

            const removed = registry.uninstall(pluginArg);
            if (removed) {
              process.stderr.write(`\n  ${c.green}✓${c.reset} Removed plugin: ${c.bold}${pluginArg}${c.reset}\n\n`);
            } else {
              process.stderr.write(`\n  ${c.red}✗${c.reset} Plugin not found: ${pluginArg}\n\n`);
            }
            break;
          }

          case 'enable': {
            if (!pluginArg) {
              logger.error('Usage: architect plugin enable <name>');
              process.exit(1);
              break;
            }
            const ok = registry.setEnabled(pluginArg, true);
            if (ok) {
              process.stderr.write(`\n  ${c.green}✓${c.reset} Enabled plugin: ${c.bold}${pluginArg}${c.reset}\n\n`);
            } else {
              process.stderr.write(`\n  ${c.red}✗${c.reset} Plugin not found: ${pluginArg}\n\n`);
            }
            break;
          }

          case 'disable': {
            if (!pluginArg) {
              logger.error('Usage: architect plugin disable <name>');
              process.exit(1);
              break;
            }
            const ok = registry.setEnabled(pluginArg, false);
            if (ok) {
              process.stderr.write(`\n  ${c.yellow}○${c.reset} Disabled plugin: ${c.bold}${pluginArg}${c.reset}\n\n`);
            } else {
              process.stderr.write(`\n  ${c.red}✗${c.reset} Plugin not found: ${pluginArg}\n\n`);
            }
            break;
          }

          default:
            process.stderr.write(`\n  ${c.bold}Plugin Commands:${c.reset}\n`);
            process.stderr.write(`  ${c.cyan}architect plugin install <package-or-path>${c.reset}  Install a plugin\n`);
            process.stderr.write(`  ${c.cyan}architect plugin list${c.reset}                      List installed plugins\n`);
            process.stderr.write(`  ${c.cyan}architect plugin search <query>${c.reset}             Search npm for plugins\n`);
            process.stderr.write(`  ${c.cyan}architect plugin remove <name>${c.reset}              Remove a plugin\n`);
            process.stderr.write(`  ${c.cyan}architect plugin enable <name>${c.reset}              Enable a plugin\n`);
            process.stderr.write(`  ${c.cyan}architect plugin disable <name>${c.reset}             Disable a plugin\n\n`);
        }
        break;
      }

      case 'kb': {
        const subCommand = args[1] ?? 'list';
        const kb = new KnowledgeBase(options.path);

        try {
          switch (subCommand) {
            case 'list': {
              const projects = kb.listProjects();
              process.stderr.write(`\n  ${c.bold}KNOWLEDGE BASE${c.reset} — ${projects.length} projects\n\n`);

              if (projects.length === 0) {
                process.stderr.write(`  ${c.dim}No analyses stored yet. Run 'architect analyze' to start building the KB.${c.reset}\n\n`);
              } else {
                for (const p of projects) {
                  const latest = kb.getLatestAnalysis(p.id);
                  const scoreStr = latest ? `${c.white}${latest.score.overall.toFixed(1)}${c.reset}/100` : `${c.dim}no analyses${c.reset}`;
                  const analysisCount = kb.listAnalyses(p.id).length;
                  process.stderr.write(
                    `  ${c.cyan}●${c.reset} ${c.bold}${p.name}${c.reset} ${c.dim}(${p.path})${c.reset}\n` +
                    `    Score: ${scoreStr} · ${analysisCount} analyses · ${p.primaryLanguages.join(', ')}\n\n`
                  );
                }
              }
              break;
            }

            case 'history': {
              const project = kb.getProjectByPath(resolve(options.path));
              if (!project) {
                process.stderr.write(`\n  ${c.dim}No KB data for this project. Run 'architect analyze' first.${c.reset}\n\n`);
                break;
              }

              const history = kb.getScoreHistory(project.id);
              process.stderr.write(`\n  ${c.bold}SCORE HISTORY${c.reset} — ${project.name} (${history.length} analyses)\n\n`);

              for (const point of history) {
                const bar = '█'.repeat(Math.round(point.overall / 5));
                const empty = '░'.repeat(20 - Math.round(point.overall / 5));
                process.stderr.write(
                  `  ${c.dim}${point.timestamp}${c.reset} ${c.cyan}${bar}${c.reset}${c.dim}${empty}${c.reset} ${c.white}${point.overall.toFixed(1)}${c.reset}\n`
                );
              }
              process.stderr.write('\n');
              break;
            }

            case 'trends': {
              const project = kb.getProjectByPath(resolve(options.path));
              if (!project) {
                process.stderr.write(`\n  ${c.dim}No KB data for this project.${c.reset}\n\n`);
                break;
              }

              const trends = kb.getAntiPatternTrends(project.id);
              process.stderr.write(`\n  ${c.bold}ANTI-PATTERN TRENDS${c.reset} — ${project.name}\n\n`);

              if (trends.length === 0) {
                process.stderr.write(`  ${c.dim}No anti-patterns recorded yet.${c.reset}\n\n`);
              } else {
                for (const t of trends) {
                  const severityColor = t.severity === 'CRITICAL' ? c.red : t.severity === 'HIGH' ? c.orange : c.yellow;
                  process.stderr.write(
                    `  ${severityColor}${t.severity.padEnd(8)}${c.reset} ${c.bold}${t.name}${c.reset} — ${t.occurrences}x (${t.firstSeen} → ${t.lastSeen})\n`
                  );
                }
                process.stderr.write('\n');
              }
              break;
            }

            case 'export': {
              const project = kb.getProjectByPath(resolve(options.path));
              if (!project) {
                process.stderr.write(`\n  ${c.dim}No KB data for this project.${c.reset}\n\n`);
                break;
              }

              const data = kb.exportProjectHistory(project.id);
              const outputPath = options.output || `architect-kb-${project.name.replace(/[^a-zA-Z0-9-]/g, '-')}.json`;
              writeFileSync(outputPath, JSON.stringify(data, null, 2));
              process.stderr.write(`\n  ${c.green}✓${c.reset} KB exported to ${c.bold}${outputPath}${c.reset}\n\n`);
              break;
            }

            case 'context': {
              const project = kb.getProjectByPath(resolve(options.path));
              if (!project) {
                process.stderr.write(`\n  ${c.dim}No KB data for this project.${c.reset}\n\n`);
                break;
              }

              const context = kb.generateLLMContext(project.id);
              console.log(context);
              break;
            }

            case 'stats': {
              const stats = kb.getStats();
              process.stderr.write(`\n  ${c.bold}KNOWLEDGE BASE STATS${c.reset}\n\n`);
              process.stderr.write(`  Projects:       ${c.white}${stats.totalProjects}${c.reset}\n`);
              process.stderr.write(`  Analyses:       ${c.white}${stats.totalAnalyses}${c.reset}\n`);
              process.stderr.write(`  Anti-patterns:  ${c.white}${stats.totalAntiPatterns}${c.reset}\n`);
              process.stderr.write(`  Decisions:      ${c.white}${stats.totalDecisions}${c.reset}\n`);
              process.stderr.write(`  Forecasts:      ${c.white}${stats.totalForecasts}${c.reset}\n`);
              process.stderr.write(`  DB size:        ${c.white}${(stats.dbSizeBytes / 1024).toFixed(1)} KB${c.reset}\n`);
              process.stderr.write(`  DB path:        ${c.dim}${kb.getDatabasePath()}${c.reset}\n\n`);
              break;
            }

            default:
              process.stderr.write(`\n  ${c.bold}Knowledge Base Commands:${c.reset}\n`);
              process.stderr.write(`  ${c.cyan}architect kb list${c.reset}               List all tracked projects\n`);
              process.stderr.write(`  ${c.cyan}architect kb history .${c.reset}           Show score history for project\n`);
              process.stderr.write(`  ${c.cyan}architect kb trends .${c.reset}            Show anti-pattern trends\n`);
              process.stderr.write(`  ${c.cyan}architect kb stats${c.reset}               Show KB statistics\n`);
              process.stderr.write(`  ${c.cyan}architect kb export .${c.reset}            Export project history as JSON\n`);
              process.stderr.write(`  ${c.cyan}architect kb context .${c.reset}           Generate LLM context summary\n\n`);
          }
        } finally {
          kb.close();
        }
        break;
      }

      default:
        logger.error(`Unknown command: ${options.command}`);
        process.exit(1);
    }
  } catch (err: any) {
    logger.error('Fatal execution error', err);
    process.exit(1);
  }
}

main();
