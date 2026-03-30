/**
 * Git History Analyzer — Temporal analysis of codebase evolution
 *
 * Reads git log to build velocity vectors, churn rates, and hotspot maps.
 * Enables Architect v4's predictive capabilities.
 *
 * Key metrics per module:
 * - Commit frequency (commits/week rolling 4-week average)
 * - Churn rate (lines added + deleted per commit)
 * - Author diversity (bus factor proxy)
 * - Change coupling (files that change together)
 *
 * @author Camilo Girardelli — Girardelli Tecnologia
 * @license MIT
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from './logger.js';

const execAsync = promisify(exec);

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: FileChange[];
}

export interface FileChange {
  path: string;
  additions: number;
  deletions: number;
}

export interface FileHistory {
  path: string;
  commits: number;
  totalAdditions: number;
  totalDeletions: number;
  churnRate: number;             // (additions + deletions) / commits
  authors: Set<string>;
  busFactor: number;             // unique authors count
  lastModified: Date;
  weeklyCommitRate: number;      // commits/week (rolling 4-week)
  isHotspot: boolean;
}

export interface ModuleHistory {
  modulePath: string;
  files: FileHistory[];
  aggregateCommits: number;
  aggregateChurn: number;
  avgWeeklyRate: number;
  topHotspots: FileHistory[];
  velocityVector: VelocityVector;
  busFactor: number;
}

export interface VelocityVector {
  /** Commit rate trend: positive = accelerating, negative = decelerating */
  commitAcceleration: number;
  /** Churn trend: positive = increasing complexity, negative = stabilizing */
  churnTrend: number;
  /** Overall direction: "accelerating" | "stable" | "decelerating" */
  direction: 'accelerating' | 'stable' | 'decelerating';
}

export interface ChangeCoupling {
  fileA: string;
  fileB: string;
  cochangeCount: number;
  confidence: number;  // cochangeCount / max(commitsA, commitsB)
}

export interface GitHistoryReport {
  projectPath: string;
  analyzedAt: string;
  periodWeeks: number;
  totalCommits: number;
  totalAuthors: number;
  modules: ModuleHistory[];
  hotspots: FileHistory[];
  changeCouplings: ChangeCoupling[];
  commitTimeline: WeeklySnapshot[];
}

export interface WeeklySnapshot {
  weekStart: string;   // ISO date
  commits: number;
  churn: number;
  activeFiles: number;
}

export interface GitAnalyzerConfig {
  /** How many weeks of history to analyze (default: 24) */
  periodWeeks?: number;
  /** Rolling window for averages (default: 4 weeks) */
  rollingWindowWeeks?: number;
  /** Churn threshold to flag as hotspot (default: 500 lines) */
  hotspotChurnThreshold?: number;
  /** Minimum co-change count for coupling (default: 3) */
  couplingMinCochanges?: number;
  /** Path to cache dir (default: .architect-cache/) */
  cacheDir?: string;
}

const DEFAULT_CONFIG: Required<GitAnalyzerConfig> = {
  periodWeeks: 24,
  rollingWindowWeeks: 4,
  hotspotChurnThreshold: 500,
  couplingMinCochanges: 3,
  cacheDir: '.architect-cache',
};

// ═══════════════════════════════════════════════════════════════
// GIT HISTORY ANALYZER
// ═══════════════════════════════════════════════════════════════

export class GitHistoryAnalyzer {
  private config: Required<GitAnalyzerConfig>;

  constructor(config?: GitAnalyzerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Analyze git history for the project at the given path.
   * Returns a comprehensive GitHistoryReport.
   */
  async analyze(projectPath: string): Promise<GitHistoryReport> {
    logger.debug('Starting GitHistory analysis', { projectPath, periodWeeks: this.config.periodWeeks });
    
    await this.validateGitRepo(projectPath);

    const sinceDate = this.getSinceDate();
    const commits = await this.parseGitLog(projectPath, sinceDate);
    
    logger.debug('Git history parsed', { commitCount: commits.length });
    const fileHistories = this.buildFileHistories(commits);
    const modules = this.groupByModule(fileHistories);
    const hotspots = this.detectHotspots(fileHistories);
    const changeCouplings = this.detectChangeCoupling(commits);
    const timeline = this.buildTimeline(commits);

    const allAuthors = new Set<string>();
    commits.forEach(c => allAuthors.add(c.author));

    return {
      projectPath,
      analyzedAt: new Date().toISOString(),
      periodWeeks: this.config.periodWeeks,
      totalCommits: commits.length,
      totalAuthors: allAuthors.size,
      modules,
      hotspots,
      changeCouplings,
      commitTimeline: timeline,
    };
  }

  // ── Git Log Parsing ──

  private async parseGitLog(projectPath: string, since: string): Promise<GitCommit[]> {
    const cmd = `git log --format='%H|%an|%aI|%s' --numstat --since="${since}" -- .`;

    let output: string;
    try {
      const { stdout } = await execAsync(cmd, {
        cwd: projectPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,  // 10MB buffer for large repos
      });
      output = stdout;
    } catch (error) {
      logger.warn('Failed to parse git log. History features will be bypassed.', { error, cmd });
      return [];
    }

    return this.parseLogOutput(output);
  }

  private parseLogOutput(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const lines = output.trim().split('\n');

    let current: GitCommit | null = null;

    for (const line of lines) {
      if (!line.trim()) {
        // Blank lines separate numstat blocks, but also appear between
        // the commit header and its numstat output. Only finalize a commit
        // on blank line if it already has file changes (otherwise it's just
        // the gap between header and numstat).
        if (current && current.files.length > 0) {
          commits.push(current);
          current = null;
        }
        continue;
      }

      // Commit header: hash|author|date|message
      if (line.includes('|') && !line.startsWith('\t') && /^[0-9a-f]{7,}/.test(line)) {
        if (current) commits.push(current);
        const parts = line.split('|');
        if (parts.length >= 4) {
          current = {
            hash: parts[0],
            author: parts[1],
            date: new Date(parts[2]),
            message: parts.slice(3).join('|'),
            files: [],
          };
        }
        continue;
      }

      // Numstat line: additions\tdeletions\tfilepath
      if (current && /^\d+\t\d+\t/.test(line)) {
        const [add, del, filePath] = line.split('\t');
        if (filePath && !filePath.includes('{') /* skip renames */) {
          current.files.push({
            path: filePath,
            additions: parseInt(add, 10) || 0,
            deletions: parseInt(del, 10) || 0,
          });
        }
      }
    }

    if (current) commits.push(current);
    return commits;
  }

  // ── File History Building ──

  private buildFileHistories(commits: GitCommit[]): Map<string, FileHistory> {
    const histories = new Map<string, FileHistory>();
    const now = new Date();
    const windowMs = this.config.rollingWindowWeeks * 7 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(now.getTime() - windowMs);

    for (const commit of commits) {
      for (const file of commit.files) {
        if (!histories.has(file.path)) {
          histories.set(file.path, {
            path: file.path,
            commits: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            churnRate: 0,
            authors: new Set(),
            busFactor: 0,
            lastModified: commit.date,
            weeklyCommitRate: 0,
            isHotspot: false,
          });
        }

        const h = histories.get(file.path)!;
        h.commits++;
        h.totalAdditions += file.additions;
        h.totalDeletions += file.deletions;
        h.authors.add(commit.author);

        if (commit.date > h.lastModified) {
          h.lastModified = commit.date;
        }
      }
    }

    // Calculate derived metrics
    const recentCommits = commits.filter(c => c.date >= windowStart);
    const weekCount = Math.max(this.config.rollingWindowWeeks, 1);

    for (const [filePath, h] of histories) {
      h.churnRate = h.commits > 0
        ? (h.totalAdditions + h.totalDeletions) / h.commits
        : 0;
      h.busFactor = h.authors.size;

      // Weekly commit rate from rolling window
      const recentFileCommits = recentCommits.filter(
        c => c.files.some(f => f.path === filePath)
      ).length;
      h.weeklyCommitRate = recentFileCommits / weekCount;

      // Hotspot: high churn + high frequency
      h.isHotspot = (h.totalAdditions + h.totalDeletions) >= this.config.hotspotChurnThreshold
        && h.weeklyCommitRate >= 1;
    }

    return histories;
  }

  // ── Module Grouping ──

  private groupByModule(fileHistories: Map<string, FileHistory>): ModuleHistory[] {
    const moduleMap = new Map<string, FileHistory[]>();

    for (const [filePath, history] of fileHistories) {
      const modulePath = this.getModulePath(filePath);
      if (!moduleMap.has(modulePath)) {
        moduleMap.set(modulePath, []);
      }
      moduleMap.get(modulePath)!.push(history);
    }

    return Array.from(moduleMap.entries()).map(([modulePath, files]) => {
      const aggregateCommits = files.reduce((s, f) => s + f.commits, 0);
      const aggregateChurn = files.reduce((s, f) => s + f.totalAdditions + f.totalDeletions, 0);
      const avgWeeklyRate = files.reduce((s, f) => s + f.weeklyCommitRate, 0) / Math.max(files.length, 1);
      const allAuthors = new Set<string>();
      files.forEach(f => f.authors.forEach(a => allAuthors.add(a)));

      const topHotspots = files
        .filter(f => f.isHotspot)
        .sort((a, b) => (b.totalAdditions + b.totalDeletions) - (a.totalAdditions + a.totalDeletions))
        .slice(0, 5);

      return {
        modulePath,
        files,
        aggregateCommits,
        aggregateChurn,
        avgWeeklyRate,
        topHotspots,
        velocityVector: this.calculateVelocity(files),
        busFactor: allAuthors.size,
      };
    }).sort((a, b) => b.aggregateChurn - a.aggregateChurn);
  }

  // ── Velocity Calculation ──

  private calculateVelocity(files: FileHistory[]): VelocityVector {
    if (files.length === 0) {
      return { commitAcceleration: 0, churnTrend: 0, direction: 'stable' };
    }

    // Sort files by last modified (most recent first)
    const sorted = [...files].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    // Split into halves: recent vs older
    const mid = Math.floor(sorted.length / 2) || 1;
    const recentHalf = sorted.slice(0, mid);
    const olderHalf = sorted.slice(mid);

    const recentAvgRate = recentHalf.reduce((s, f) => s + f.weeklyCommitRate, 0) / recentHalf.length;
    const olderAvgRate = olderHalf.length > 0
      ? olderHalf.reduce((s, f) => s + f.weeklyCommitRate, 0) / olderHalf.length
      : recentAvgRate;

    const recentAvgChurn = recentHalf.reduce((s, f) => s + f.churnRate, 0) / recentHalf.length;
    const olderAvgChurn = olderHalf.length > 0
      ? olderHalf.reduce((s, f) => s + f.churnRate, 0) / olderHalf.length
      : recentAvgChurn;

    const commitAcceleration = olderAvgRate > 0
      ? ((recentAvgRate - olderAvgRate) / olderAvgRate) * 100
      : 0;

    const churnTrend = olderAvgChurn > 0
      ? ((recentAvgChurn - olderAvgChurn) / olderAvgChurn) * 100
      : 0;

    let direction: VelocityVector['direction'] = 'stable';
    if (commitAcceleration > 15) direction = 'accelerating';
    else if (commitAcceleration < -15) direction = 'decelerating';

    return {
      commitAcceleration: Math.round(commitAcceleration * 10) / 10,
      churnTrend: Math.round(churnTrend * 10) / 10,
      direction,
    };
  }

  // ── Hotspot Detection ──

  private detectHotspots(fileHistories: Map<string, FileHistory>): FileHistory[] {
    return Array.from(fileHistories.values())
      .filter(f => f.isHotspot)
      .sort((a, b) => (b.totalAdditions + b.totalDeletions) - (a.totalAdditions + a.totalDeletions))
      .slice(0, 20);
  }

  // ── Change Coupling Detection ──

  private detectChangeCoupling(commits: GitCommit[]): ChangeCoupling[] {
    const cochangeMap = new Map<string, number>();
    const fileCommitCount = new Map<string, number>();

    for (const commit of commits) {
      const files = commit.files.map(f => f.path).sort();

      for (const f of files) {
        fileCommitCount.set(f, (fileCommitCount.get(f) || 0) + 1);
      }

      // Pairwise co-change counting (limit to 10 files per commit to avoid explosion)
      const limited = files.slice(0, 10);
      for (let i = 0; i < limited.length; i++) {
        for (let j = i + 1; j < limited.length; j++) {
          const key = `${limited[i]}|||${limited[j]}`;
          cochangeMap.set(key, (cochangeMap.get(key) || 0) + 1);
        }
      }
    }

    const couplings: ChangeCoupling[] = [];
    for (const [key, count] of cochangeMap) {
      if (count < this.config.couplingMinCochanges) continue;

      const [fileA, fileB] = key.split('|||');
      const maxCommits = Math.max(
        fileCommitCount.get(fileA) || 1,
        fileCommitCount.get(fileB) || 1,
      );

      couplings.push({
        fileA,
        fileB,
        cochangeCount: count,
        confidence: Math.round((count / maxCommits) * 100) / 100,
      });
    }

    return couplings
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 50);
  }

  // ── Timeline Building ──

  private buildTimeline(commits: GitCommit[]): WeeklySnapshot[] {
    if (commits.length === 0) return [];

    const snapshots = new Map<string, WeeklySnapshot>();
    const toMonday = (d: Date): string => {
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.toISOString().split('T')[0];
    };
    const now = new Date();

    for (let w = 0; w < this.config.periodWeeks; w++) {
      const key = toMonday(new Date(now.getTime() - w * 604800000));
      if (!snapshots.has(key)) {
        snapshots.set(key, { weekStart: key, commits: 0, churn: 0, activeFiles: 0 });
      }
    }

    for (const commit of commits) {
      const key = toMonday(new Date(commit.date));
      const snap = snapshots.get(key);
      if (snap) {
        snap.commits++;
        snap.churn += commit.files.reduce((s, f) => s + f.additions + f.deletions, 0);
        snap.activeFiles += commit.files.length;
      }
    }

    return Array.from(snapshots.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  }

  // ── Utilities ──

  private async validateGitRepo(projectPath: string): Promise<void> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', {
        cwd: projectPath,
        encoding: 'utf-8',
      });
    } catch {
      throw new Error(`Not a git repository: ${projectPath}`);
    }
  }

  private getSinceDate(): string {
    const d = new Date();
    d.setDate(d.getDate() - (this.config.periodWeeks * 7));
    return d.toISOString().split('T')[0];
  }

  private getModulePath(filePath: string): string {
    const parts = filePath.split('/');
    // Use first directory as module, or "root" if no directory
    return parts.length > 1 ? parts[0] : 'root';
  }
}
