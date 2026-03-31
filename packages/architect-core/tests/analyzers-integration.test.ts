/**
 * Integration Tests — Full pipeline: GitHistory → TemporalScorer → ForecastEngine
 *
 * Validates end-to-end flow with a real git repo and type contracts
 * between the three analyzer stages.
 */

import { GitHistoryAnalyzer } from '../src/infrastructure/git-history.js';
import { TemporalScorer } from '../src/core/analyzers/temporal-scorer.js';
import { ForecastEngine } from '../src/core/analyzers/forecast.js';
import { saveToCache, loadFromCache } from '../src/infrastructure/git-cache.js';
import type { GitHistoryReport } from '../src/infrastructure/git-history.js';
import type { TemporalReport } from '../src/core/analyzers/temporal-scorer.js';
import type { WeatherForecast } from '../src/core/analyzers/forecast.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ═══════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════

const TEST_DIR = path.join('/tmp', 'architect-integration-test');

function setupRealRepo(): void {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });

  execSync('git init', { cwd: TEST_DIR, stdio: 'pipe' });
  execSync('git config user.email "dev@test.com"', { cwd: TEST_DIR, stdio: 'pipe' });
  execSync('git config user.name "Dev"', { cwd: TEST_DIR, stdio: 'pipe' });

  // Build a realistic repo with multiple modules
  const files = [
    { path: 'src/api/routes.ts', content: 'export const routes = [];' },
    { path: 'src/api/middleware.ts', content: 'export function auth() {}' },
    { path: 'src/service/user.ts', content: 'export class UserService {}' },
    { path: 'src/data/repo.ts', content: 'export class UserRepo {}' },
    { path: 'lib/utils.ts', content: 'export function log() {}' },
  ];

  for (const f of files) {
    const dir = path.dirname(path.join(TEST_DIR, f.path));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, f.path), f.content);
  }
  execSync('git add . && git commit -m "initial"', { cwd: TEST_DIR, stdio: 'pipe' });

  // Simulate some activity
  for (let i = 0; i < 5; i++) {
    fs.writeFileSync(
      path.join(TEST_DIR, 'src/api/routes.ts'),
      `export const routes = [${i}];\n`.repeat(i + 1),
    );
    fs.writeFileSync(
      path.join(TEST_DIR, 'src/service/user.ts'),
      `export class UserService { v${i}() {} }`,
    );
    execSync(`git add . && git commit -m "iteration ${i}"`, { cwd: TEST_DIR, stdio: 'pipe' });
  }
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('Analyzer Pipeline Integration', () => {
  let gitReport: GitHistoryReport;
  let temporalReport: TemporalReport;
  let forecast: WeatherForecast;

  beforeAll(async () => {
    setupRealRepo();

    // Stage 1: Git History
    const gitAnalyzer = new GitHistoryAnalyzer({ periodWeeks: 52 });
    gitReport = await gitAnalyzer.analyze(TEST_DIR);

    // Stage 2: Temporal Scoring
    const scorer = new TemporalScorer({ projectionWeeks: 12 });
    const staticScores = new Map<string, number>();
    for (const mod of gitReport.modules) {
      staticScores.set(mod.modulePath, 70); // assume 70 baseline
    }
    temporalReport = scorer.score(gitReport, staticScores);

    // Stage 3: Forecast
    const engine = new ForecastEngine();
    forecast = engine.forecast(gitReport, temporalReport);
  });

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe('Stage 1 → Stage 2 contract', () => {
    it('git report modules should have matching temporal scores', () => {
      for (const mod of gitReport.modules) {
        const ts = temporalReport.modules.find(m => m.module === mod.modulePath);
        expect(ts).toBeDefined();
        expect(ts!.staticScore).toBeDefined();
        expect(ts!.temporalScore).toBeDefined();
      }
    });
  });

  describe('Stage 2 → Stage 3 contract', () => {
    it('temporal modules should have matching forecast modules', () => {
      for (const ts of temporalReport.modules) {
        const fm = forecast.modules.find(m => m.module === ts.module);
        expect(fm).toBeDefined();
        expect(fm!.currentHealth).toMatch(/^(healthy|at-risk|degrading|critical)$/);
        expect(fm!.forecast6Months).toMatch(/^(stable|declining|breakdown)$/);
      }
    });
  });

  describe('end-to-end output', () => {
    it('forecast should have valid outlook', () => {
      expect(['sunny', 'cloudy', 'stormy']).toContain(forecast.overallOutlook);
    });

    it('forecast should have a headline', () => {
      expect(forecast.headline.length).toBeGreaterThan(0);
    });

    it('all pre-anti-patterns should have valid types', () => {
      const validTypes = [
        'emerging-god-class',
        'emerging-shotgun-surgery',
        'emerging-feature-envy',
        'bus-factor-risk',
        'complexity-spiral',
        'coupling-magnet',
      ];
      for (const p of forecast.preAntiPatterns) {
        expect(validTypes).toContain(p.type);
        expect(p.confidence).toBeGreaterThan(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      }
    });

    it('modules should have bottleneck probability between 0 and 1', () => {
      for (const m of forecast.modules) {
        expect(m.bottleneckProbability).toBeGreaterThanOrEqual(0);
        expect(m.bottleneckProbability).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('git cache', () => {
    it('should save and load cache correctly', () => {
      saveToCache(gitReport, TEST_DIR);

      const loaded = loadFromCache(TEST_DIR, '.architect-cache', 3600000);
      expect(loaded).not.toBeNull();
      expect(loaded!.projectPath).toBe(gitReport.projectPath);
      expect(loaded!.totalCommits).toBe(gitReport.totalCommits);
      expect(loaded!.totalAuthors).toBe(gitReport.totalAuthors);
    });

    it('should return null for expired cache', () => {
      saveToCache(gitReport, TEST_DIR);

      const loaded = loadFromCache(TEST_DIR, '.architect-cache', 0); // 0ms = expired
      expect(loaded).toBeNull();
    });

    it('should return null when cache does not exist', () => {
      const loaded = loadFromCache('/tmp/nonexistent-path');
      expect(loaded).toBeNull();
    });
  });
});
