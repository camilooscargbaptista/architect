import { KnowledgeBase } from '../src/core/knowledge-base/knowledge-base.js';
import { architectEvents } from '../src/core/events.js';
import {
  registerSelfImprovingLoop,
  emitViolationEvents,
  emitAnalysisCompleted,
  suggestRules,
} from '../src/core/self-improving-loop.js';
import type { AnalysisReport } from '../src/core/types/core.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function makeReport(overrides?: Partial<AnalysisReport>): AnalysisReport {
  return {
    timestamp: overrides?.timestamp ?? new Date().toISOString(),
    projectInfo: {
      path: '/test/project',
      name: 'test-project',
      frameworks: [],
      primaryLanguages: ['typescript'],
      totalFiles: 20,
      totalLines: 2000,
    },
    score: {
      overall: overrides?.score?.overall ?? 72,
      components: [],
      breakdown: { modularity: 75, coupling: 70, cohesion: 68, layering: 72 },
    },
    antiPatterns: overrides?.antiPatterns ?? [
      { name: 'God Class', severity: 'HIGH', location: 'src/app.ts', description: 'x', suggestion: 'y' },
      { name: 'Circular Dependency', severity: 'CRITICAL', location: 'src/a→b', description: 'x', suggestion: 'y' },
    ],
    layers: [],
    dependencyGraph: { nodes: [], edges: [] },
    suggestions: [],
    diagram: { mermaid: '', type: 'dependency' },
    ...overrides,
  };
}

describe('Self-Improving Loop', () => {
  let tmpDir: string;
  let kb: KnowledgeBase;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'architect-sil-'));
    kb = new KnowledgeBase(tmpDir);
    architectEvents.clear();
  });

  afterEach(() => {
    kb.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('registerSelfImprovingLoop', () => {
    it('should register listeners and return cleanup function', () => {
      const cleanup = registerSelfImprovingLoop(kb, '/test');
      expect(architectEvents.listenerCount('violation.detected')).toBe(1);
      expect(architectEvents.listenerCount('analysis.completed')).toBe(1);
      expect(architectEvents.listenerCount('score.degraded')).toBe(1);

      cleanup();
      expect(architectEvents.listenerCount('violation.detected')).toBe(0);
      expect(architectEvents.listenerCount('analysis.completed')).toBe(0);
      expect(architectEvents.listenerCount('score.degraded')).toBe(0);
    });

    it('should persist constraints on violation events', async () => {
      kb.persistAnalysis(makeReport());
      const cleanup = registerSelfImprovingLoop(kb, '/test');

      await architectEvents.emit({
        type: 'violation.detected',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        violation: { level: 'error', rule: 'quality_gates.min_overall_score', message: 'Score too low' },
        context: { score: 50, antiPatternCount: 3 },
      });

      // Check constraint was persisted
      const db = (kb as any).db;
      const constraints = db.prepare('SELECT * FROM constraints WHERE active = 1').all();
      expect(constraints.length).toBe(1);
      expect(constraints[0].rule_type).toBe('quality_gates.min_overall_score');

      cleanup();
    });

    it('should not duplicate constraints for the same rule', async () => {
      kb.persistAnalysis(makeReport());
      const cleanup = registerSelfImprovingLoop(kb, '/test');

      // Emit same violation twice
      for (let i = 0; i < 2; i++) {
        await architectEvents.emit({
          type: 'violation.detected',
          timestamp: new Date().toISOString(),
          projectPath: '/test/project',
          violation: { level: 'error', rule: 'quality_gates.min_overall_score', message: 'Score too low' },
          context: { score: 50, antiPatternCount: 3 },
        });
      }

      const db = (kb as any).db;
      const constraints = db.prepare('SELECT * FROM constraints WHERE active = 1').all();
      expect(constraints.length).toBe(1);

      cleanup();
    });

    it('should emit score.degraded when score drops significantly', async () => {
      // First analysis: score 80
      kb.persistAnalysis(makeReport({ timestamp: '2026-01-01T00:00:00Z', score: { overall: 80, components: [], breakdown: { modularity: 80, coupling: 80, cohesion: 80, layering: 80 } } }));
      // Second analysis: score 70 (drop of 10)
      kb.persistAnalysis(makeReport({ timestamp: '2026-01-02T00:00:00Z', score: { overall: 70, components: [], breakdown: { modularity: 70, coupling: 70, cohesion: 70, layering: 70 } } }));

      const degradations: number[] = [];
      architectEvents.on('score.degraded', (e) => { degradations.push(e.delta); });

      const cleanup = registerSelfImprovingLoop(kb, '/test');

      await architectEvents.emit({
        type: 'analysis.completed',
        timestamp: new Date().toISOString(),
        projectPath: '/test/project',
        score: 70,
        antiPatternCount: 5,
      });

      expect(degradations.length).toBe(1);
      expect(degradations[0]).toBe(-10);

      cleanup();
    });
  });

  describe('emitViolationEvents', () => {
    it('should emit one event per violation', async () => {
      const received: string[] = [];
      architectEvents.on('violation.detected', (e) => { received.push(e.violation.rule); });

      emitViolationEvents(
        [
          { level: 'error', rule: 'min_score', message: 'too low' },
          { level: 'warning', rule: 'max_high_ap', message: 'too many' },
        ],
        '/test',
        60,
        5,
      );

      // Give async emit time to process
      await new Promise(r => setTimeout(r, 10));

      expect(received).toEqual(['min_score', 'max_high_ap']);
    });
  });

  describe('emitAnalysisCompleted', () => {
    it('should emit analysis.completed event', async () => {
      let received: any = null;
      architectEvents.on('analysis.completed', (e) => { received = e; });

      emitAnalysisCompleted('/test', 85, 2, 42);
      await new Promise(r => setTimeout(r, 10));

      expect(received).not.toBeNull();
      expect(received.score).toBe(85);
      expect(received.analysisId).toBe(42);
    });
  });

  describe('suggestRules', () => {
    it('should return empty suggestions with insufficient history', () => {
      kb.persistAnalysis(makeReport());
      const suggestions = suggestRules(kb, '/test/project');
      expect(suggestions).toEqual([]);
    });

    it('should suggest min_overall_score when score is consistently high', () => {
      // 5 analyses with scores above 65
      for (let i = 0; i < 5; i++) {
        kb.persistAnalysis(makeReport({
          timestamp: new Date(Date.now() + i * 86400000).toISOString(),
          score: { overall: 70 + i, components: [], breakdown: { modularity: 75, coupling: 70, cohesion: 68, layering: 72 } },
          antiPatterns: [],
        }));
      }

      const suggestions = suggestRules(kb, '/test/project');
      const scoreSuggestion = suggestions.find(s => s.type === 'quality_gate' && s.yaml.includes('min_overall_score'));
      expect(scoreSuggestion).toBeDefined();
      expect(scoreSuggestion!.confidence).toBe('high');
    });

    it('should suggest banning circular dependencies when recurring', () => {
      for (let i = 0; i < 4; i++) {
        kb.persistAnalysis(makeReport({
          timestamp: new Date(Date.now() + i * 86400000).toISOString(),
          antiPatterns: [
            { name: 'Circular Dependency', severity: 'CRITICAL', location: 'src/a→b', description: 'x', suggestion: 'y' },
          ],
        }));
      }

      const suggestions = suggestRules(kb, '/test/project');
      const circDepSuggestion = suggestions.find(s => s.yaml.includes('allow_circular_dependencies: false'));
      expect(circDepSuggestion).toBeDefined();
    });

    it('should suggest anti-pattern limits for recurring HIGH patterns', () => {
      for (let i = 0; i < 4; i++) {
        kb.persistAnalysis(makeReport({
          timestamp: new Date(Date.now() + i * 86400000).toISOString(),
          antiPatterns: [
            { name: 'God Class', severity: 'HIGH', location: 'src/app.ts', description: 'x', suggestion: 'y' },
            { name: 'God Class', severity: 'HIGH', location: 'src/main.ts', description: 'x', suggestion: 'y' },
          ],
        }));
      }

      const suggestions = suggestRules(kb, '/test/project');
      const apSuggestion = suggestions.find(s => s.type === 'anti_pattern_limit');
      expect(apSuggestion).toBeDefined();
      expect(apSuggestion!.yaml).toContain('max_high_anti_patterns');
    });

    it('should not suggest rules for unknown projects', () => {
      const suggestions = suggestRules(kb, '/nonexistent');
      expect(suggestions).toEqual([]);
    });
  });
});
