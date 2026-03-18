#!/usr/bin/env node

/**
 * Architect CLI
 * Executa análise arquitetural e gera relatórios em múltiplos formatos
 *
 * Uso:
 *   npx architect analyze ./src
 *   npx architect analyze ./src --format html --output report.html
 *   npx architect diagram ./src
 *   npx architect score ./src
 *   npx architect anti-patterns ./src
 *   npx architect layers ./src
 */

import { architect } from './index.js';
import { ReportGenerator } from './reporter.js';
import { HtmlReportGenerator } from './html-reporter.js';
import { RefactorReportGenerator } from './refactor-reporter.js';
import { writeFileSync } from 'fs';
import { resolve, basename } from 'path';

type OutputFormat = 'json' | 'markdown' | 'html';

interface CliOptions {
  command: string;
  path: string;
  format: OutputFormat;
  output?: string;
}

/**
 * CLI Progress Logger — mostra estágio atual e tempo decorrido
 * Usa output síncrono (console.log) porque as operações do Architect bloqueiam o event loop.
 */
class ProgressLogger {
  private startTime: number;
  private stageStart: number;
  private currentStage = '';

  constructor() {
    this.startTime = Date.now();
    this.stageStart = Date.now();
  }

  start(stage: string): void {
    this.currentStage = stage;
    this.stageStart = Date.now();
    // Print immediately so user sees it BEFORE the blocking operation
    console.log(`⏳ ${stage}`);
  }

  complete(message?: string): void {
    const elapsed = ((Date.now() - this.stageStart) / 1000).toFixed(1);
    const total = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const displayMsg = message || this.currentStage;
    console.log(`✅ ${displayMsg}  (${elapsed}s | total: ${total}s)`);
  }

  fail(message: string): void {
    const elapsed = ((Date.now() - this.stageStart) / 1000).toFixed(1);
    console.log(`⚠️  ${message}  (${elapsed}s)`);
  }

  summary(lines: string[]): void {
    const total = ((Date.now() - this.startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  Completed in ${total}s`);
    lines.forEach(l => console.log(l));
  }
}
function parseArgs(args: string[]): CliOptions {
  const command = args[0] || 'analyze';
  const pathArg = args.find((a) => !a.startsWith('--') && a !== command) || '.';
  const formatIdx = args.indexOf('--format');
  const format = (formatIdx >= 0 ? args[formatIdx + 1] : 'html') as OutputFormat;
  const outputIdx = args.indexOf('--output');
  const output = outputIdx >= 0 ? args[outputIdx + 1] : undefined;

  return { command, path: resolve(pathArg), format, output };
}

function printUsage(): void {
  console.log(`
🏗️  Architect — AI-powered architecture analysis

Usage:
  architect <command> [path] [options]

Commands:
  analyze         Full architecture analysis (default)
  refactor        Generate refactoring plan with actionable steps
  agents          Generate/audit .agent/ directory with AI agents
  diagram         Generate architecture diagram only
  score           Calculate quality score only
  anti-patterns   Detect anti-patterns only
  layers          Analyze layer structure only

Options:
  --format <type>   Output format: html, json, markdown (default: html)
  --output <file>   Output file path (default: architect-report.<ext>)
  --help            Show this help message

Examples:
  architect analyze ./src
  architect analyze ./src --format html --output report.html
  architect score ./src --format json
  architect anti-patterns ./backend/src
  `);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const options = parseArgs(args);

  console.log('🏗️  Architect — Architecture Analysis');
  console.log(`📂 Path: ${options.path}`);
  console.log(`📋 Command: ${options.command}`);
  console.log(`📄 Format: ${options.format}\n`);

  try {
    switch (options.command) {
      case 'analyze': {
        const progress = new ProgressLogger();

        progress.start('Scanning files & analyzing architecture...');
        const report = await architect.analyze(options.path);
        progress.complete(`Scanned ${report.projectInfo.totalFiles} files (${report.projectInfo.totalLines.toLocaleString()} lines)`);

        progress.start('Generating refactoring plan...');
        const plan = architect.refactor(report, options.path);
        progress.complete(`Refactoring plan: ${plan.steps.length} steps, ${plan.totalOperations} operations`);

        progress.start('Analyzing agent system...');
        const agentSuggestion = architect.suggestAgents(report, plan, options.path);
        progress.complete(`Agents: ${agentSuggestion.suggestedAgents.length} suggested${agentSuggestion.hasExistingAgents ? ' (existing .agent/ audited)' : ''}`);

        const projectName = report.projectInfo.name || basename(options.path);

        if (options.format === 'html') {
          progress.start('Building HTML report...');
          const htmlGenerator = new HtmlReportGenerator();
          const html = htmlGenerator.generateHtml(report, plan, agentSuggestion);
          const outputPath = options.output || `architect-report-${projectName}.html`;
          writeFileSync(outputPath, html);
          progress.complete(`HTML report saved: ${outputPath}`);
        } else if (options.format === 'markdown') {
          progress.start('Building Markdown report...');
          const mdGenerator = new ReportGenerator();
          const markdown = mdGenerator.generateMarkdownReport(report);
          const outputPath = options.output || `architect-report-${projectName}.md`;
          writeFileSync(outputPath, markdown);
          progress.complete(`Markdown report saved: ${outputPath}`);
        } else {
          progress.start('Building JSON report...');
          const outputPath = options.output || `architect-report-${projectName}.json`;
          writeFileSync(outputPath, JSON.stringify({ report, plan, agentSuggestion }, null, 2));
          progress.complete(`JSON report saved: ${outputPath}`);
        }

        // Print summary
        progress.summary([
          ``,
          `═══════════════════════════════════════`,
          `  SCORE: ${report.score.overall}/100`,
          `═══════════════════════════════════════`,
          `├─ Modularity: ${report.score.breakdown.modularity}`,
          `├─ Coupling:   ${report.score.breakdown.coupling}`,
          `├─ Cohesion:   ${report.score.breakdown.cohesion}`,
          `└─ Layering:   ${report.score.breakdown.layering}`,
          ``,
          `📁 Files: ${report.projectInfo.totalFiles} | 📝 Lines: ${report.projectInfo.totalLines.toLocaleString()}`,
          `⚠️  Anti-patterns: ${report.antiPatterns.length}`,
          `🔧 Refactoring: ${plan.steps.length} steps (${plan.totalOperations} ops)`,
          `🤖 Agents: ${agentSuggestion.suggestedAgents.length} suggested`,
        ]);
        break;
      }

      case 'refactor': {
        const report = await architect.analyze(options.path);
        const plan = architect.refactor(report, options.path);
        const projectName = report.projectInfo.name || basename(options.path);

        if (options.format === 'json') {
          const outputPath = options.output || `refactor-plan-${projectName}.json`;
          writeFileSync(outputPath, JSON.stringify(plan, null, 2));
          console.log(`✅ JSON refactoring plan saved to: ${outputPath}`);
        } else {
          const refactorReporter = new RefactorReportGenerator();
          const html = refactorReporter.generateHtml(plan);
          const outputPath = options.output || `refactor-plan-${projectName}.html`;
          writeFileSync(outputPath, html);
          console.log(`✅ Refactoring plan saved to: ${outputPath}`);
        }

        console.log(`\n═══════════════════════════════════════`);
        console.log(`  REFACTORING PLAN`);
        console.log(`═══════════════════════════════════════`);
        console.log(`├─ Steps:      ${plan.steps.length}`);
        console.log(`├─ Operations: ${plan.totalOperations}`);
        console.log(`├─ Tier 1:     ${plan.tier1Steps} (rule-based)`);
        console.log(`├─ Tier 2:     ${plan.tier2Steps} (AST-based)`);
        console.log(`├─ Current:    ${plan.currentScore.overall}/100`);
        console.log(`└─ Estimated:  ${plan.estimatedScoreAfter.overall}/100 (+${plan.estimatedScoreAfter.overall - plan.currentScore.overall})`);
        break;
      }

      case 'agents': {
        const report = await architect.analyze(options.path);
        const plan = architect.refactor(report, options.path);
        const outputDir = options.output || undefined;
        const result = architect.agents(report, plan, options.path, outputDir);

        console.log(`\n═══════════════════════════════════════`);
        console.log(`  🤖 AGENT SYSTEM`);
        console.log(`═══════════════════════════════════════`);

        if (result.generated.length > 0) {
          console.log(`\n✅ Generated ${result.generated.length} files:`);
          for (const file of result.generated) {
            console.log(`   📄 ${file}`);
          }
        }

        if (result.audit.length > 0) {
          const missing = result.audit.filter(f => f.type === 'MISSING');
          const improvements = result.audit.filter(f => f.type === 'IMPROVEMENT');
          const ok = result.audit.filter(f => f.type === 'OK');

          if (ok.length > 0) {
            console.log(`\n✅ ${ok.length} checks passed`);
          }
          if (missing.length > 0) {
            console.log(`\n❌ ${missing.length} missing (auto-generated):`);
            for (const f of missing) {
              console.log(`   📄 ${f.file} — ${f.description}`);
            }
          }
          if (improvements.length > 0) {
            console.log(`\n💡 ${improvements.length} improvement suggestions:`);
            for (const f of improvements) {
              console.log(`   ⚡ ${f.description}`);
              if (f.suggestion) console.log(`      → ${f.suggestion}`);
            }
          }
        }

        console.log(`\n📊 Score: ${report.score.overall}/100`);
        break;
      }

      case 'diagram': {
        const diagram = await architect.diagram(options.path);
        if (options.output) {
          writeFileSync(options.output, diagram);
          console.log(`✅ Diagram saved to: ${options.output}`);
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
          console.log(`Score: ${score.overall}/100`);
          for (const [name, value] of Object.entries(score.breakdown)) {
            console.log(`  ${name}: ${value}/100`);
          }
        }
        break;
      }

      case 'anti-patterns': {
        const patterns = await architect.antiPatterns(options.path);
        if (options.format === 'json') {
          console.log(JSON.stringify(patterns, null, 2));
        } else {
          console.log(`Found ${patterns.length} anti-pattern(s):\n`);
          for (const p of patterns) {
            console.log(`  [${p.severity}] ${p.name}: ${p.description}`);
          }
        }
        break;
      }

      case 'layers': {
        const layers = await architect.layers(options.path);
        if (options.format === 'json') {
          console.log(JSON.stringify(layers, null, 2));
        } else {
          for (const l of layers) {
            console.log(`${l.name}: ${l.files.length} files`);
          }
        }
        break;
      }

      default:
        console.error(`❌ Unknown command: ${options.command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
