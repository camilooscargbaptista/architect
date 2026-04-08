import { KnowledgeBase } from '../src/core/knowledge-base/knowledge-base.js';
import { AnalysisReport } from '../src/core/types/core.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('KnowledgeBase', () => {
  let tmpDir: string;
  let kb: KnowledgeBase;

  const mockReport: AnalysisReport = {
    timestamp: '2026-04-08T10:00:00Z',
    projectInfo: {
      path: '/test/project',
      name: 'test-project',
      frameworks: ['express'],
      primaryLanguages: ['typescript'],
      totalFiles: 42,
      totalLines: 3500,
    },
    score: {
      overall: 72.5,
      components: [
        { name: 'Modularity', score: 30, maxScore: 40, weight: 0.4, explanation: 'Good module separation' },
        { name: 'Coupling', score: 18, maxScore: 25, weight: 0.25, explanation: 'Low coupling' },
        { name: 'Cohesion', score: 14, maxScore: 20, weight: 0.2, explanation: 'Moderate cohesion' },
        { name: 'Layering', score: 10.5, maxScore: 15, weight: 0.15, explanation: 'Clean layers' },
      ],
      breakdown: { modularity: 75, coupling: 72, cohesion: 70, layering: 70 },
    },
    antiPatterns: [
      { name: 'God Class', severity: 'HIGH', location: 'src/app.ts', description: 'Too many dependents', suggestion: 'Split' },
      { name: 'Circular Dependency', severity: 'CRITICAL', location: 'src/a.ts → src/b.ts', description: 'Cycle', suggestion: 'Extract interface' },
    ],
    layers: [
      { name: 'API', files: ['src/routes/index.ts'], description: 'API layer' },
      { name: 'Service', files: ['src/services/user.ts'], description: 'Service layer' },
    ],
    dependencyGraph: {
      nodes: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
      edges: [
        { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
        { from: 'src/b.ts', to: 'src/c.ts', type: 'import', weight: 1 },
        { from: 'src/c.ts', to: 'src/a.ts', type: 'import', weight: 1 },
      ],
    },
    suggestions: [
      { priority: 'HIGH', title: 'Break circular dep', description: 'Extract interface', impact: '+5 points' },
    ],
    diagram: { mermaid: 'graph TD; A-->B;', type: 'dependency' },
  };

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'architect-kb-test-'));
    kb = new KnowledgeBase(tmpDir);
  });

  afterEach(() => {
    kb.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Persistence ──────────────────────────────────────

  describe('persistAnalysis', () => {
    it('should persist an analysis report and return an ID', () => {
      const id = kb.persistAnalysis(mockReport);
      expect(id).toBeGreaterThan(0);
    });

    it('should create a project record on first analysis', () => {
      kb.persistAnalysis(mockReport);
      const projects = kb.listProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0]!.name).toBe('test-project');
      expect(projects[0]!.primaryLanguages).toEqual(['typescript']);
    });

    it('should reuse existing project on subsequent analyses', () => {
      kb.persistAnalysis(mockReport);

      const laterReport = { ...mockReport, timestamp: '2026-04-09T10:00:00Z' };
      kb.persistAnalysis(laterReport);

      const projects = kb.listProjects();
      expect(projects).toHaveLength(1);
    });

    it('should persist anti-patterns', () => {
      const analysisId = kb.persistAnalysis(mockReport);
      const antiPatterns = kb.getAntiPatterns(analysisId);
      expect(antiPatterns).toHaveLength(2);
      expect(antiPatterns[0]!.name).toBe('God Class');
      expect(antiPatterns[1]!.severity).toBe('CRITICAL');
    });

    it('should persist dependencies', () => {
      const analysisId = kb.persistAnalysis(mockReport);
      const deps = kb.getFileDependencies(analysisId, 'src/a.ts');
      expect(deps.imports).toHaveLength(1);
      expect(deps.imports[0]!.to).toBe('src/b.ts');
    });
  });

  // ── Queries ──────────────────────────────────────────

  describe('queries', () => {
    let projectId: number;

    beforeEach(() => {
      kb.persistAnalysis(mockReport);
      const project = kb.getProjectByPath('/test/project');
      projectId = project!.id;
    });

    it('should get latest analysis', () => {
      const latest = kb.getLatestAnalysis(projectId);
      expect(latest).not.toBeNull();
      expect(latest!.score.overall).toBe(72.5);
      expect(latest!.score.modularity).toBe(75);
    });

    it('should list analyses in reverse chronological order', () => {
      // Add a second analysis
      const laterReport = {
        ...mockReport,
        timestamp: '2026-04-09T10:00:00Z',
        score: { ...mockReport.score, overall: 78, breakdown: { modularity: 80, coupling: 75, cohesion: 75, layering: 75 } },
      };
      kb.persistAnalysis(laterReport);

      const analyses = kb.listAnalyses(projectId);
      expect(analyses).toHaveLength(2);
      expect(analyses[0]!.score.overall).toBe(78);
      expect(analyses[1]!.score.overall).toBe(72.5);
    });

    it('should return score history in chronological order', () => {
      const laterReport = {
        ...mockReport,
        timestamp: '2026-04-09T10:00:00Z',
        score: { ...mockReport.score, overall: 78, breakdown: { modularity: 80, coupling: 75, cohesion: 75, layering: 75 } },
      };
      kb.persistAnalysis(laterReport);

      const history = kb.getScoreHistory(projectId);
      expect(history).toHaveLength(2);
      expect(history[0]!.overall).toBe(72.5);
      expect(history[1]!.overall).toBe(78);
    });

    it('should calculate score delta between analyses', () => {
      const laterReport = {
        ...mockReport,
        timestamp: '2026-04-09T10:00:00Z',
        score: { ...mockReport.score, overall: 78, breakdown: { modularity: 80, coupling: 75, cohesion: 75, layering: 75 } },
      };
      kb.persistAnalysis(laterReport);

      const delta = kb.getScoreDelta(projectId);
      expect(delta).not.toBeNull();
      expect(delta!.current).toBe(78);
      expect(delta!.previous).toBe(72.5);
      expect(delta!.delta).toBeCloseTo(5.5);
    });

    it('should return null delta for single analysis', () => {
      const delta = kb.getScoreDelta(projectId);
      expect(delta).toBeNull();
    });

    it('should track anti-pattern trends', () => {
      // Second analysis with same anti-pattern
      const laterReport = { ...mockReport, timestamp: '2026-04-09T10:00:00Z' };
      kb.persistAnalysis(laterReport);

      const trends = kb.getAntiPatternTrends(projectId);
      expect(trends.length).toBeGreaterThan(0);
      const godClass = trends.find(t => t.name === 'God Class');
      expect(godClass).toBeDefined();
      expect(godClass!.occurrences).toBe(2);
    });

    it('should get top hubs', () => {
      const analysisId = kb.getLatestAnalysis(projectId)!.id;
      const hubs = kb.getTopHubs(analysisId);
      expect(hubs.length).toBeGreaterThan(0);
      // src/a.ts gets imported by src/c.ts, so it should be a hub
      expect(hubs.some(h => h.file === 'src/a.ts')).toBe(true);
    });

    it('should get full report', () => {
      const analysisId = kb.getLatestAnalysis(projectId)!.id;
      const report = kb.getFullReport(analysisId);
      expect(report).not.toBeNull();
      expect(report!.projectInfo.name).toBe('test-project');
    });
  });

  // ── ADRs ─────────────────────────────────────────────

  describe('decisions (ADR)', () => {
    it('should add and list decisions', () => {
      kb.persistAnalysis(mockReport);
      const project = kb.getProjectByPath('/test/project')!;

      const id = kb.addDecision(project.id, {
        title: 'Use event-driven architecture',
        status: 'proposed',
        context: 'Need loose coupling between services',
        decision: 'Adopt event bus pattern',
        consequences: 'Eventual consistency trade-off',
      });

      expect(id).toBeGreaterThan(0);

      const decisions = kb.listDecisions(project.id);
      expect(decisions).toHaveLength(1);
      expect(decisions[0]!.title).toBe('Use event-driven architecture');
      expect(decisions[0]!.status).toBe('proposed');
    });

    it('should update decision status', () => {
      kb.persistAnalysis(mockReport);
      const project = kb.getProjectByPath('/test/project')!;
      const id = kb.addDecision(project.id, { title: 'Migrate to microservices' });
      kb.updateDecisionStatus(id, 'accepted');

      const decisions = kb.listDecisions(project.id);
      expect(decisions[0]!.status).toBe('accepted');
    });
  });

  // ── Validation ───────────────────────────────────────

  describe('validation persistence', () => {
    it('should persist validation results', () => {
      const analysisId = kb.persistAnalysis(mockReport);
      const validationId = kb.persistValidation(analysisId, {
        success: false,
        violations: [
          { level: 'error', rule: 'min_overall_score', message: 'Score 72.5 below minimum 80' },
        ],
      });
      expect(validationId).toBeGreaterThan(0);
    });
  });

  // ── Stats & Export ───────────────────────────────────

  describe('stats and export', () => {
    it('should return KB stats', () => {
      kb.persistAnalysis(mockReport);
      const stats = kb.getStats();
      expect(stats.totalProjects).toBe(1);
      expect(stats.totalAnalyses).toBe(1);
      expect(stats.totalAntiPatterns).toBe(2);
      expect(stats.dbSizeBytes).toBeGreaterThan(0);
    });

    it('should export project history', () => {
      kb.persistAnalysis(mockReport);
      const project = kb.getProjectByPath('/test/project')!;
      const history = kb.exportProjectHistory(project.id);
      expect(history).not.toBeNull();
      expect(history!.project.name).toBe('test-project');
      expect(history!.analyses).toHaveLength(1);
      expect(history!.scoreHistory).toHaveLength(1);
    });

    it('should generate LLM context', () => {
      kb.persistAnalysis(mockReport);
      const project = kb.getProjectByPath('/test/project')!;
      const context = kb.generateLLMContext(project.id);
      expect(context).toContain('test-project');
      expect(context).toContain('72.5');
      expect(context).toContain('typescript');
    });

    it('should return null for non-existent project export', () => {
      const history = kb.exportProjectHistory(999);
      expect(history).toBeNull();
    });
  });

  // ── Schema migration ─────────────────────────────────

  describe('schema management', () => {
    it('should handle re-opening existing database', () => {
      kb.persistAnalysis(mockReport);
      kb.close();

      // Re-open same database
      const kb2 = new KnowledgeBase(tmpDir);
      const projects = kb2.listProjects();
      expect(projects).toHaveLength(1);
      kb2.close();

      // Re-assign so afterEach doesn't double-close
      kb = new KnowledgeBase(tmpDir);
    });
  });
});
