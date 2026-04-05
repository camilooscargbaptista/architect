/**
 * Tests for GitHistoryAnalyzer
 *
 * Validates git log parsing, file history building, velocity vectors,
 * change coupling detection, and timeline construction.
 */

import { GitHistoryAnalyzer } from '../src/infrastructure/git-history.js';
import type {
  GitHistoryReport,
// @ts-ignore
// @ts-ignore
// @ts-ignore
} from '../src/infrastructure/git-history.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════

const TEST_DIR = path.join('/tmp', 'architect-git-history-test');

function setupGitRepo(): void {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  execSync('git init', { cwd: TEST_DIR, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: TEST_DIR, stdio: 'pipe' });
  execSync('git config user.name "TestUser"', { cwd: TEST_DIR, stdio: 'pipe' });
}

function commitFile(
  filePath: string,
  content: string,
  message: string,
  author = 'TestUser <test@test.com>',
): void {
  const fullPath = path.join(TEST_DIR, filePath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content);
  execSync(`git add "${filePath}"`, { cwd: TEST_DIR, stdio: 'pipe' });
  execSync(`git commit --author="${author}" -m "${message}"`, {
    cwd: TEST_DIR,
    stdio: 'pipe',
  });
}

function cleanupRepo(): void {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

// ═══════════════════════════════════════════════════════════════
// UNIT TESTS — parseLogOutput (via analyze)
// ═══════════════════════════════════════════════════════════════

describe('GitHistoryAnalyzer', () => {
  beforeAll(() => {
    setupGitRepo();

    // Create initial files across two modules
    commitFile('src/core.ts', 'export class Core {}', 'initial core', 'Alice <alice@test.com>');
    commitFile('src/utils.ts', 'export function util() {}', 'add utils', 'Alice <alice@test.com>');
    commitFile('lib/helper.ts', 'export function help() {}', 'add helper', 'Bob <bob@test.com>');

    // Add more changes to create churn
    commitFile('src/core.ts', 'export class Core { run() {} }', 'enhance core', 'Bob <bob@test.com>');
    commitFile('src/core.ts', 'export class Core { run() { return 1; } }', 'fix core', 'Alice <alice@test.com>');

    // Concurrent changes for coupling detection
    const coupledContent1 = 'export class Core { run() { return 2; } }';
    const coupledContent2 = 'export function util() { return true; }';
    const p1 = path.join(TEST_DIR, 'src/core.ts');
    const p2 = path.join(TEST_DIR, 'src/utils.ts');
    fs.writeFileSync(p1, coupledContent1);
    fs.writeFileSync(p2, coupledContent2);
    execSync('git add .', { cwd: TEST_DIR, stdio: 'pipe' });
    execSync('git commit --author="Alice <alice@test.com>" -m "coupled change 1"', {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    // Another coupled change
    fs.writeFileSync(p1, coupledContent1 + '\n// v2');
    fs.writeFileSync(p2, coupledContent2 + '\n// v2');
    execSync('git add .', { cwd: TEST_DIR, stdio: 'pipe' });
    execSync('git commit --author="Bob <bob@test.com>" -m "coupled change 2"', {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });

    // Third coupled change to meet the default minCochanges=3
    fs.writeFileSync(p1, coupledContent1 + '\n// v3');
    fs.writeFileSync(p2, coupledContent2 + '\n// v3');
    execSync('git add .', { cwd: TEST_DIR, stdio: 'pipe' });
    execSync('git commit --author="Alice <alice@test.com>" -m "coupled change 3"', {
      cwd: TEST_DIR,
      stdio: 'pipe',
    });
  });

  afterAll(() => {
    cleanupRepo();
  });

  describe('analyze()', () => {
    let report: GitHistoryReport;

    beforeAll(async () => {
      const analyzer = new GitHistoryAnalyzer({ periodWeeks: 52 });
      report = await analyzer.analyze(TEST_DIR);
    });

    it('should return correct project path', () => {
      expect(report.projectPath).toBe(TEST_DIR);
    });

    it('should have analyzedAt timestamp', () => {
      expect(report.analyzedAt).toBeDefined();
      expect(new Date(report.analyzedAt).getTime()).not.toBeNaN();
    });

    it('should count total commits', () => {
      expect(report.totalCommits).toBeGreaterThanOrEqual(7);
    });

    it('should count unique authors', () => {
      expect(report.totalAuthors).toBe(2); // Alice + Bob
    });

    it('should detect modules by first directory level', () => {
      const moduleNames = report.modules.map(m => m.modulePath);
      expect(moduleNames).toContain('src');
      expect(moduleNames).toContain('lib');
    });

    it('should build file histories with correct metrics', () => {
      const srcModule = report.modules.find(m => m.modulePath === 'src');
      expect(srcModule).toBeDefined();

      const coreFile = srcModule!.files.find(f => f.path === 'src/core.ts');
      expect(coreFile).toBeDefined();
      expect(coreFile!.commits).toBeGreaterThanOrEqual(5);
      expect(coreFile!.busFactor).toBe(2); // Alice + Bob
      expect(coreFile!.totalAdditions).toBeGreaterThan(0);
    });

    it('should calculate churn rate correctly', () => {
      const srcModule = report.modules.find(m => m.modulePath === 'src');
      const coreFile = srcModule!.files.find(f => f.path === 'src/core.ts');
      expect(coreFile!.churnRate).toBeGreaterThan(0);
      expect(coreFile!.churnRate).toBe(
        (coreFile!.totalAdditions + coreFile!.totalDeletions) / coreFile!.commits
      );
    });

    it('should build weekly timeline', () => {
      expect(report.commitTimeline.length).toBeGreaterThan(0);
      const total = report.commitTimeline.reduce((s, w) => s + w.commits, 0);
      expect(total).toBe(report.totalCommits);
    });
  });

  describe('change coupling', () => {
    it('should detect coupled files', async () => {
      const analyzer = new GitHistoryAnalyzer({ periodWeeks: 52, couplingMinCochanges: 3 });
      const report = await analyzer.analyze(TEST_DIR);

      const coupling = report.changeCouplings.find(
        c =>
          (c.fileA === 'src/core.ts' && c.fileB === 'src/utils.ts') ||
          (c.fileA === 'src/utils.ts' && c.fileB === 'src/core.ts')
      );

      expect(coupling).toBeDefined();
      expect(coupling!.cochangeCount).toBeGreaterThanOrEqual(3);
      expect(coupling!.confidence).toBeGreaterThan(0);
      expect(coupling!.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('velocity vectors', () => {
    it('should calculate velocity for each module', async () => {
      const analyzer = new GitHistoryAnalyzer({ periodWeeks: 52 });
      const report = await analyzer.analyze(TEST_DIR);

      const srcModule = report.modules.find(m => m.modulePath === 'src');
      expect(srcModule).toBeDefined();
      expect(srcModule!.velocityVector).toBeDefined();
      expect(srcModule!.velocityVector.direction).toMatch(/^(accelerating|stable|decelerating)$/);
      expect(typeof srcModule!.velocityVector.commitAcceleration).toBe('number');
      expect(typeof srcModule!.velocityVector.churnTrend).toBe('number');
    });
  });

  describe('module aggregation', () => {
    it('should aggregate commits across module files', async () => {
      const analyzer = new GitHistoryAnalyzer({ periodWeeks: 52 });
      const report = await analyzer.analyze(TEST_DIR);

      const srcModule = report.modules.find(m => m.modulePath === 'src');
      expect(srcModule!.aggregateCommits).toBe(
        srcModule!.files.reduce((s, f) => s + f.commits, 0)
      );
    });

    it('should calculate bus factor per module', async () => {
      const analyzer = new GitHistoryAnalyzer({ periodWeeks: 52 });
      const report = await analyzer.analyze(TEST_DIR);

      const srcModule = report.modules.find(m => m.modulePath === 'src');
      expect(srcModule!.busFactor).toBe(2); // Alice + Bob both committed to src/
    });

    it('should sort modules by aggregate churn descending', async () => {
      const analyzer = new GitHistoryAnalyzer({ periodWeeks: 52 });
      const report = await analyzer.analyze(TEST_DIR);

      for (let i = 1; i < report.modules.length; i++) {
        expect(report.modules[i - 1]!.aggregateChurn).toBeGreaterThanOrEqual(
          report.modules[i]!.aggregateChurn
        );
      }
    });
  });

  describe('error handling', () => {
    it('should throw for non-git directory', async () => {
      const tmpDir = path.join('/tmp', 'not-a-git-repo');
      fs.mkdirSync(tmpDir, { recursive: true });

      const analyzer = new GitHistoryAnalyzer();
      await expect(analyzer.analyze(tmpDir)).rejects.toThrow('Not a git repository');

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('configuration', () => {
    it('should respect custom period weeks', async () => {
      const analyzer = new GitHistoryAnalyzer({ periodWeeks: 1 });
      const report = await analyzer.analyze(TEST_DIR);
      expect(report.periodWeeks).toBe(1);
    });

    it('should respect custom coupling threshold', async () => {
      const analyzer = new GitHistoryAnalyzer({ periodWeeks: 52, couplingMinCochanges: 100 });
      const report = await analyzer.analyze(TEST_DIR);
      expect(report.changeCouplings.length).toBe(0);
    });
  });
});
