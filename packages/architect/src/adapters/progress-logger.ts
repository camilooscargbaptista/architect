import { ProgressEvent } from '../core/architect.js';
import { basename } from 'path';

// ── ANSI Colors & Styles ──
export const c = {
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
export class ProgressReporter {
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
    w.write(`${c.darkGray}  │${c.reset}  ${c.cyan}${c.bold}⚡ ARCHITECT v8.1${c.reset}  ${c.dim}Enterprise Architecture Intelligence${c.reset}     ${c.darkGray}│${c.reset}\n`);
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

  private printPhaseComplete(key: string, _phase: PhaseConfig, metrics?: Record<string, number | string>): void {
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
