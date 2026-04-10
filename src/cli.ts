#!/usr/bin/env node

/**
 * Architect CLI v3.1
 * Enterprise Architecture Analysis — @girardelli/architect
 *
 * Uso:
 *   npx architect analyze ./src
 *   npx architect analyze ./src --format html --output report.html
 *   npx architect diagram ./src
 *   npx architect score ./src
 *   npx architect anti-patterns ./src
 */

import { architect, ProgressEvent } from './index.js';
import { ReportGenerator } from './reporter.js';
import { HtmlReportGenerator } from './html-reporter.js';
import { RefactorReportGenerator } from './refactor-reporter.js';
import { writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { Command } from 'commander';

type OutputFormat = 'json' | 'markdown' | 'html';

interface CliOptions {
  command: string;
  path: string;
  format: OutputFormat;
  output?: string;
}

// ── ANSI Colors & Styles ──
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  // Colors
  red: '\x1b[38;5;196m',
  green: '\x1b[38;5;46m',
  blue: '\x1b[38;5;33m',
  cyan: '\x1b[38;5;51m',
  yellow: '\x1b[38;5;220m',
  magenta: '\x1b[38;5;201m',
  orange: '\x1b[38;5;208m',
  white: '\x1b[38;5;255m',
  gray: '\x1b[38;5;240m',
  darkGray: '\x1b[38;5;236m',
  // Bg
  bgBlue: '\x1b[48;5;17m',
  bgGreen: '\x1b[48;5;22m',
  bgRed: '\x1b[48;5;52m',
  bgCyan: '\x1b[48;5;23m',
};

// ── Phase config ──
interface PhaseConfig {
  icon: string;
  label: string;
  verb: string;
  color: string;
}

const PHASES: Record<string, PhaseConfig> = {
  scan:          { icon: '◉', label: 'FILE SCANNER',        verb: 'Scanning filesystem',         color: c.cyan },
  dependencies:  { icon: '◉', label: 'DEPENDENCY MAPPER',   verb: 'Mapping import graph',        color: c.blue },
  layers:        { icon: '◉', label: 'LAYER DETECTOR',      verb: 'Classifying architecture',    color: c.magenta },
  antipatterns:  { icon: '◉', label: 'PATTERN ANALYZER',    verb: 'Detecting anti-patterns',     color: c.orange },
  scoring:       { icon: '◉', label: 'QUALITY ENGINE',      verb: 'Computing quality metrics',   color: c.yellow },
  normalize:     { icon: '◉', label: 'PATH NORMALIZER',     verb: 'Normalizing paths',           color: c.gray },
  summarize:     { icon: '◉', label: 'AI SUMMARIZER',       verb: 'Generating project summary',  color: c.green },
};

const PHASE_ORDER = ['scan', 'dependencies', 'layers', 'antipatterns', 'scoring', 'normalize', 'summarize'];

/**
 * Enterprise-Grade Progress Reporter
 * Real-time phase tracking with visual feedback
 */
class ProgressReporter {
  private startTime: number;
  private phaseStart: number = 0;
  private completedPhases: string[] = [];
  private totalPhases: number;
  private scanMetrics: Record<string, number | string> = {};

  constructor() {
    this.startTime = Date.now();
    this.totalPhases = PHASE_ORDER.length;
  }

  /** Print the stylized header */
  printHeader(projectPath: string): void {
    const name = basename(projectPath);
    const w = process.stderr;

    w.write('\n');
    w.write(`${c.darkGray}  ┌─────────────────────────────────────────────────────────────────┐${c.reset}\n`);
    w.write(`${c.darkGray}  │${c.reset}  ${c.cyan}${c.bold}⚡ ARCHITECT v3.1${c.reset}  ${c.dim}Enterprise Architecture Intelligence${c.reset}     ${c.darkGray}│${c.reset}\n`);
    w.write(`${c.darkGray}  │${c.reset}  ${c.dim}@girardelli/architect — powered by Girardelli Tecnologia${c.reset}    ${c.darkGray}│${c.reset}\n`);
    w.write(`${c.darkGray}  └─────────────────────────────────────────────────────────────────┘${c.reset}\n`);
    w.write('\n');
    w.write(`  ${c.dim}Target:${c.reset} ${c.white}${c.bold}${name}${c.reset}\n`);
    w.write(`  ${c.dim}Path:${c.reset}   ${c.gray}${projectPath}${c.reset}\n`);
    w.write('\n');
    w.write(`  ${c.dim}──── Analysis Pipeline ────────────────────────────────────────${c.reset}\n`);
    w.write('\n');
  }

  /** Handle a progress event from the analyzer */
  onProgress(event: ProgressEvent): void {
    const phase = PHASES[event.phase];
    if (!phase) return;

    if (event.status === 'start') {
      this.phaseStart = Date.now();
      this.printPhaseStart(event.phase, phase);
    } else if (event.status === 'complete') {
      this.completedPhases.push(event.phase);
      this.printPhaseComplete(event.phase, phase, event.metrics);
      if (event.metrics) {
        Object.assign(this.scanMetrics, event.metrics);
      }
    }
  }

  private printPhaseStart(key: string, phase: PhaseConfig): void {
    const idx = PHASE_ORDER.indexOf(key) + 1;
    const bar = this.buildProgressBar(this.completedPhases.length, this.totalPhases);
    process.stderr.write(
      `  ${c.dim}[${idx}/${this.totalPhases}]${c.reset} ${phase.color}${phase.icon}${c.reset} ${c.bold}${phase.label}${c.reset} ${c.dim}— ${phase.verb}...${c.reset}  ${bar}\n`
    );
  }

  private printPhaseComplete(key: string, phase: PhaseConfig, metrics?: Record<string, number | string>): void {
    const elapsed = Date.now() - this.phaseStart;
    const metricStr = metrics ? this.formatMetrics(key, metrics) : '';
    process.stderr.write(
      `  ${c.dim}     └─${c.reset} ${c.green}✓${c.reset} ${c.dim}${this.formatTime(elapsed)}${c.reset}${metricStr}\n`
    );
  }

  private formatMetrics(phase: string, m: Record<string, number | string>): string {
    const parts: string[] = [];
    switch (phase) {
      case 'scan':
        parts.push(`${c.white}${m.files}${c.reset}${c.dim} files${c.reset}`);
        parts.push(`${c.white}${Number(m.lines).toLocaleString()}${c.reset}${c.dim} lines${c.reset}`);
        parts.push(`${c.white}${m.languages}${c.reset}${c.dim} langs${c.reset}`);
        break;
      case 'dependencies':
        parts.push(`${c.white}${m.edges}${c.reset}${c.dim} edges${c.reset}`);
        parts.push(`${c.white}${m.modules}${c.reset}${c.dim} modules${c.reset}`);
        break;
      case 'layers':
        parts.push(`${c.white}${m.layers}${c.reset}${c.dim} layers${c.reset}`);
        parts.push(`${c.white}${m.classified}${c.reset}${c.dim} classified${c.reset}`);
        break;
      case 'antipatterns':
        if (Number(m.total) === 0) {
          parts.push(`${c.green}clean${c.reset}`);
        } else {
          parts.push(`${c.yellow}${m.total}${c.reset}${c.dim} found${c.reset}`);
          if (Number(m.critical) > 0) parts.push(`${c.red}${m.critical} critical${c.reset}`);
          if (Number(m.high) > 0) parts.push(`${c.orange}${m.high} high${c.reset}`);
        }
        break;
      case 'scoring': {
        const overall = Number(m.overall);
        const scoreColor = overall >= 80 ? c.green : overall >= 60 ? c.yellow : c.red;
        parts.push(`${scoreColor}${c.bold}${overall}/100${c.reset}`);
        parts.push(`${c.dim}M:${m.modularity} C:${m.coupling} Co:${m.cohesion} L:${m.layering}${c.reset}`);
        break;
      }
      case 'summarize':
        parts.push(`${c.white}${m.modules}${c.reset}${c.dim} modules${c.reset}`);
        parts.push(`${c.white}${m.techStack}${c.reset}${c.dim} technologies${c.reset}`);
        break;
    }
    return parts.length ? `  ${c.dim}│${c.reset} ${parts.join(`${c.dim} · ${c.reset}`)}` : '';
  }

  private buildProgressBar(done: number, total: number): string {
    const width = 20;
    const filled = Math.round((done / total) * width);
    const empty = width - filled;
    const pct = Math.round((done / total) * 100);
    const bar = `${c.cyan}${'█'.repeat(filled)}${c.darkGray}${'░'.repeat(empty)}${c.reset}`;
    return `${c.dim}[${c.reset}${bar}${c.dim}]${c.reset} ${c.dim}${pct}%${c.reset}`;
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  /** Print extra phase for refactor/agents/report generation */
  printExtraPhase(label: string, verb: string, color: string = c.cyan): void {
    this.phaseStart = Date.now();
    const idx = this.completedPhases.length + 1;
    process.stderr.write(
      `  ${c.dim}[${idx}/—]${c.reset} ${color}◉${c.reset} ${c.bold}${label}${c.reset} ${c.dim}— ${verb}...${c.reset}\n`
    );
  }

  printExtraComplete(detail: string): void {
    const elapsed = Date.now() - this.phaseStart;
    process.stderr.write(
      `  ${c.dim}     └─${c.reset} ${c.green}✓${c.reset} ${c.dim}${this.formatTime(elapsed)}${c.reset}  ${detail}\n`
    );
  }

  /** Final summary with score visualization */
  printSummary(score: number, breakdown: Record<string, number>, stats: {
    files: number; lines: number; antiPatterns: number;
    refactorSteps?: number; refactorOps?: number; agents?: number;
  }): void {
    const totalTime = Date.now() - this.startTime;
    const w = process.stderr;

    w.write('\n');
    w.write(`  ${c.dim}──── Results ──────────────────────────────────────────────────${c.reset}\n`);
    w.write('\n');

    // Score meter
    const scoreColor = score >= 80 ? c.green : score >= 60 ? c.yellow : c.red;
    const meterWidth = 40;
    const filled = Math.round((score / 100) * meterWidth);
    const meter = `${scoreColor}${'━'.repeat(filled)}${c.darkGray}${'━'.repeat(meterWidth - filled)}${c.reset}`;
    const grade = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : score >= 50 ? 'D' : 'F';

    w.write(`  ${c.bold}  ARCHITECTURE SCORE${c.reset}\n`);
    w.write(`  ${meter} ${scoreColor}${c.bold}${score}/100${c.reset} ${c.dim}(${grade})${c.reset}\n`);
    w.write('\n');
    w.write(`  ${c.dim}  Modularity${c.reset}  ${this.miniBar(breakdown.modularity)} ${c.white}${breakdown.modularity}${c.reset}\n`);
    w.write(`  ${c.dim}  Coupling${c.reset}    ${this.miniBar(breakdown.coupling)} ${c.white}${breakdown.coupling}${c.reset}\n`);
    w.write(`  ${c.dim}  Cohesion${c.reset}    ${this.miniBar(breakdown.cohesion)} ${c.white}${breakdown.cohesion}${c.reset}\n`);
    w.write(`  ${c.dim}  Layering${c.reset}    ${this.miniBar(breakdown.layering)} ${c.white}${breakdown.layering}${c.reset}\n`);
    w.write('\n');

    // Stats line
    w.write(`  ${c.cyan}📁${c.reset} ${c.white}${stats.files}${c.reset}${c.dim} files${c.reset}`);
    w.write(`  ${c.cyan}📝${c.reset} ${c.white}${stats.lines.toLocaleString()}${c.reset}${c.dim} lines${c.reset}`);
    w.write(`  ${c.cyan}⚠️${c.reset}  ${c.white}${stats.antiPatterns}${c.reset}${c.dim} anti-patterns${c.reset}`);
    if (stats.refactorSteps !== undefined) {
      w.write(`  ${c.cyan}🔧${c.reset} ${c.white}${stats.refactorSteps}${c.reset}${c.dim} steps${c.reset}`);
    }
    if (stats.agents !== undefined) {
      w.write(`  ${c.cyan}🤖${c.reset} ${c.white}${stats.agents}${c.reset}${c.dim} agents${c.reset}`);
    }
    w.write('\n');

    // Timing
    w.write(`\n  ${c.dim}⏱  Completed in ${this.formatTime(totalTime)}${c.reset}\n`);
    w.write('\n');
  }

  private miniBar(value: number): string {
    const w = 15;
    const f = Math.round((value / 100) * w);
    const color = value >= 80 ? c.green : value >= 60 ? c.yellow : c.red;
    return `${color}${'▓'.repeat(f)}${c.darkGray}${'░'.repeat(w - f)}${c.reset}`;
  }
}

// ── CLI Parsing (commander) ──

const VALID_FORMATS: OutputFormat[] = ['json', 'markdown', 'html'];

function validateFormat(value: string, command: string, defaults: OutputFormat = 'html'): OutputFormat {
  if (!value) return defaults;
  if (!VALID_FORMATS.includes(value as OutputFormat)) {
    throw new Error(`Invalid --format "${value}" for ${command}. Valid: ${VALID_FORMATS.join(', ')}`);
  }
  return value as OutputFormat;
}

function resolveProjectPath(pathArg: string): string {
  const abs = resolve(pathArg);
  if (!existsSync(abs)) {
    throw new Error(`Path does not exist: ${abs}`);
  }
  const stat = statSync(abs);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${abs}`);
  }
  return abs;
}

function ensureOutputDir(outputPath: string): void {
  const dir = dirname(outputPath);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function runCommand(command: string, path: string, format: OutputFormat, output?: string): Promise<void> {
  const options: CliOptions = { command, path, format, output };

  try {
    switch (options.command) {
      case 'analyze': {
        const progress = new ProgressReporter();
        progress.printHeader(options.path);

        const report = await architect.analyze(options.path, (e) => progress.onProgress(e));

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

        const projectName = report.projectInfo.name || basename(options.path);

        // Report generation
        if (options.format === 'html') {
          progress.printExtraPhase('REPORT BUILDER', 'Generating interactive HTML report', c.cyan);
          const htmlGenerator = new HtmlReportGenerator();
          const html = htmlGenerator.generateHtml(report, plan, agentSuggestion);
          const outputPath = options.output || `architect-report-${projectName}.html`;
          ensureOutputDir(outputPath);
          writeFileSync(outputPath, html);
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        } else if (options.format === 'markdown') {
          progress.printExtraPhase('REPORT BUILDER', 'Generating Markdown report', c.cyan);
          const mdGenerator = new ReportGenerator();
          const markdown = mdGenerator.generateMarkdownReport(report);
          const outputPath = options.output || `architect-report-${projectName}.md`;
          ensureOutputDir(outputPath);
          writeFileSync(outputPath, markdown);
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        } else {
          progress.printExtraPhase('REPORT BUILDER', 'Generating JSON report', c.cyan);
          const outputPath = options.output || `architect-report-${projectName}.json`;
          ensureOutputDir(outputPath);
          writeFileSync(outputPath, JSON.stringify({ report, plan, agentSuggestion }, null, 2));
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
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
        const progress = new ProgressReporter();
        progress.printHeader(options.path);

        const report = await architect.analyze(options.path, (e) => progress.onProgress(e));

        progress.printExtraPhase('REFACTOR ENGINE', 'Building refactoring plan', c.orange);
        const plan = architect.refactor(report, options.path);
        const projectName = report.projectInfo.name || basename(options.path);

        if (options.format === 'json') {
          const outputPath = options.output || `refactor-plan-${projectName}.json`;
          ensureOutputDir(outputPath);
          writeFileSync(outputPath, JSON.stringify(plan, null, 2));
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        } else {
          const refactorReporter = new RefactorReportGenerator();
          const html = refactorReporter.generateHtml(plan);
          const outputPath = options.output || `refactor-plan-${projectName}.html`;
          ensureOutputDir(outputPath);
          writeFileSync(outputPath, html);
          progress.printExtraComplete(`${c.green}${outputPath}${c.reset}`);
        }

        process.stderr.write(`\n  ${c.bold}REFACTORING PLAN${c.reset}\n`);
        process.stderr.write(`  ${c.dim}Steps:${c.reset} ${c.white}${plan.steps.length}${c.reset}  ${c.dim}Ops:${c.reset} ${c.white}${plan.totalOperations}${c.reset}  ${c.dim}Tier1:${c.reset} ${c.white}${plan.tier1Steps}${c.reset}  ${c.dim}Tier2:${c.reset} ${c.white}${plan.tier2Steps}${c.reset}\n`);
        process.stderr.write(`  ${c.dim}Score:${c.reset} ${c.white}${plan.currentScore.overall}${c.reset}${c.dim} → ${c.reset}${c.green}${plan.estimatedScoreAfter.overall}${c.reset} ${c.dim}(+${plan.estimatedScoreAfter.overall - plan.currentScore.overall})${c.reset}\n\n`);
        break;
      }

      case 'agents': {
        const progress = new ProgressReporter();
        progress.printHeader(options.path);

        const report = await architect.analyze(options.path, (e) => progress.onProgress(e));

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

      case 'diagram': {
        const diagram = await architect.diagram(options.path);
        if (options.output) {
          ensureOutputDir(options.output);
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

      default:
        throw new Error(`Unknown command: ${options.command}`);
    }
  } catch (error) {
    process.stderr.write(`\n  ${c.red}${c.bold}✗ ERROR${c.reset}: ${error instanceof Error ? error.message : error}\n\n`);
    process.exit(1);
  }
}

// ── commander wiring ──

const program = new Command();

program
  .name('architect')
  .description('⚡ Architect v3.1 — Enterprise Architecture Intelligence')
  .version('3.1.0')
  .showHelpAfterError(true);

const registerCommand = (
  name: string,
  description: string,
  defaultFormat: OutputFormat = 'html',
): void => {
  program
    .command(name)
    .description(description)
    .argument('[path]', 'target project path', '.')
    .option('-f, --format <type>', `output format (${VALID_FORMATS.join('|')})`, defaultFormat)
    .option('-o, --output <file>', 'output file path')
    .action(async (pathArg: string, opts: { format: string; output?: string }) => {
      const path = resolveProjectPath(pathArg);
      const format = validateFormat(opts.format, name, defaultFormat);
      await runCommand(name, path, format, opts.output);
    });
};

registerCommand('analyze', 'Full architecture analysis (scan + deps + layers + anti-patterns + scoring)', 'html');
registerCommand('refactor', 'Generate refactoring plan with actionable steps', 'html');
registerCommand('agents', 'Generate/audit .agent/ directory with AI agents', 'html');
registerCommand('diagram', 'Generate Mermaid architecture diagram only', 'markdown');
registerCommand('score', 'Calculate quality score only', 'markdown');
registerCommand('anti-patterns', 'Detect anti-patterns only', 'markdown');
registerCommand('layers', 'Analyze layer structure only', 'markdown');

// Default to `analyze` when called with no subcommand
if (process.argv.length === 2) {
  process.argv.push('analyze');
}

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`\n  ${c.red}${c.bold}✗ ERROR${c.reset}: ${err instanceof Error ? err.message : err}\n\n`);
  process.exit(1);
});
