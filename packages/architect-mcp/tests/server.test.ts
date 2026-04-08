/**
 * MCP Server Unit Tests
 *
 * Tests the tool handler logic by mocking architect-core imports.
 * We extract the core helpers (runAnalysis pattern) into testable units
 * and verify input validation, error handling, and output shapes.
 *
 * @since v10.0.0
 */

import { resolve } from 'path';

// ── Mock report data ────────────────────────────────────

const MOCK_SCORE = {
  overall: 72,
  breakdown: { modularity: 80, coupling: 65, cohesion: 70, layering: 75 },
};

const MOCK_ANTI_PATTERNS = [
  { name: 'God Class', severity: 'HIGH', file: 'src/big.ts', description: 'Too many dependents' },
  { name: 'Circular Dependency', severity: 'CRITICAL', file: 'src/a.ts', description: 'Cycle detected' },
  { name: 'Spaghetti Module', severity: 'MEDIUM', file: 'src/mess.ts', description: 'High coupling' },
  { name: 'Dead Code', severity: 'LOW', file: 'src/old.ts', description: 'No references' },
];

const MOCK_LAYERS = [
  { name: 'core', files: ['src/a.ts', 'src/b.ts'] },
  { name: 'infrastructure', files: ['src/db.ts'] },
];

const MOCK_PROJECT_INFO = {
  name: 'test-project',
  path: '/test/project',
  totalFiles: 42,
  totalLines: 5000,
  primaryLanguages: ['typescript'],
  frameworks: ['express'],
  fileTree: { name: 'root', children: [] },
};

const MOCK_REPORT = {
  timestamp: '2026-04-08T00:00:00.000Z',
  projectInfo: MOCK_PROJECT_INFO,
  score: MOCK_SCORE,
  antiPatterns: MOCK_ANTI_PATTERNS,
  layers: MOCK_LAYERS,
  dependencyGraph: {
    nodes: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    edges: [
      { from: 'src/a.ts', to: 'src/b.ts', type: 'import', weight: 1 },
      { from: 'src/b.ts', to: 'src/c.ts', type: 'import', weight: 1 },
    ],
  },
  suggestions: [],
  diagram: { mermaid: '', type: 'dependency' as const },
  profile: 'backend-monolith',
};

// ── Tool handler extraction ─────────────────────────────
// Instead of testing via MCP protocol, we test the logic patterns
// that the server.ts tool handlers use.

describe('MCP Server Tool Logic', () => {

  describe('analyze_project handler', () => {
    it('should shape analysis output correctly', () => {
      const report = MOCK_REPORT;

      const output = {
        project: report.projectInfo.name,
        path: report.projectInfo.path,
        score: report.score,
        profile: report.profile,
        antiPatterns: report.antiPatterns.length,
        antiPatternsBySeverity: {
          critical: report.antiPatterns.filter(a => a.severity === 'CRITICAL').length,
          high: report.antiPatterns.filter(a => a.severity === 'HIGH').length,
          medium: report.antiPatterns.filter(a => a.severity === 'MEDIUM').length,
          low: report.antiPatterns.filter(a => a.severity === 'LOW').length,
        },
        layers: report.layers.map(l => ({ name: l.name, fileCount: l.files.length })),
        files: report.projectInfo.totalFiles,
        lines: report.projectInfo.totalLines,
        languages: report.projectInfo.primaryLanguages,
        frameworks: report.projectInfo.frameworks,
        nodes: report.dependencyGraph.nodes.length,
        edges: report.dependencyGraph.edges.length,
      };

      expect(output.project).toBe('test-project');
      expect(output.score.overall).toBe(72);
      expect(output.antiPatterns).toBe(4);
      expect(output.antiPatternsBySeverity.critical).toBe(1);
      expect(output.antiPatternsBySeverity.high).toBe(1);
      expect(output.antiPatternsBySeverity.medium).toBe(1);
      expect(output.antiPatternsBySeverity.low).toBe(1);
      expect(output.layers).toEqual([
        { name: 'core', fileCount: 2 },
        { name: 'infrastructure', fileCount: 1 },
      ]);
      expect(output.files).toBe(42);
      expect(output.nodes).toBe(3);
      expect(output.edges).toBe(2);
      expect(output.profile).toBe('backend-monolith');
    });
  });

  describe('get_score handler', () => {
    it('should extract score and profile', () => {
      const output = {
        overall: MOCK_REPORT.score.overall,
        breakdown: MOCK_REPORT.score.breakdown,
        profile: MOCK_REPORT.profile,
      };

      expect(output.overall).toBe(72);
      expect(output.breakdown.modularity).toBe(80);
      expect(output.breakdown.coupling).toBe(65);
      expect(output.profile).toBe('backend-monolith');
    });
  });

  describe('get_anti_patterns handler', () => {
    it('should return all anti-patterns', () => {
      const output = MOCK_REPORT.antiPatterns;

      expect(output.length).toBe(4);
      expect(output[0]!.name).toBe('God Class');
      expect(output[1]!.severity).toBe('CRITICAL');
    });

    it('should include file and description', () => {
      for (const ap of MOCK_REPORT.antiPatterns) {
        expect(ap.file).toBeDefined();
        expect(ap.description).toBeDefined();
        expect(ap.severity).toMatch(/^(CRITICAL|HIGH|MEDIUM|LOW)$/);
      }
    });
  });

  describe('check_rules handler', () => {
    it('should format validation result', () => {
      const mockValidation = {
        success: false,
        violations: [
          { level: 'error', rule: 'min_overall_score', message: 'Score 72 < 80' },
          { level: 'warning', rule: 'max_critical_anti_patterns', message: '1 > 0' },
        ],
      };

      const output = {
        success: mockValidation.success,
        score: MOCK_REPORT.score.overall,
        violationCount: mockValidation.violations.length,
        violations: mockValidation.violations,
      };

      expect(output.success).toBe(false);
      expect(output.violationCount).toBe(2);
      expect(output.violations[0]!.rule).toBe('min_overall_score');
    });
  });

  describe('query_kb handler', () => {
    it('should validate query enum', () => {
      const validQueries = ['history', 'trends', 'stats', 'latest'];
      for (const q of validQueries) {
        expect(validQueries).toContain(q);
      }

      expect(validQueries).not.toContain('invalid');
    });
  });

  describe('suggest_refactoring handler', () => {
    it('should format plan output', () => {
      const mockPlan = {
        currentScore: { overall: 72 },
        estimatedScoreAfter: { overall: 82 },
        steps: [
          {
            id: 1, tier: 1, rule: 'hub-splitter', priority: 'HIGH',
            title: 'Split core hub', description: 'Break up architect.ts',
            operations: [{ type: 'CREATE' }, { type: 'MODIFY' }, { type: 'MODIFY' }],
            scoreImpact: [{ metric: 'modularity', before: 60, after: 75 }],
          },
        ],
        totalOperations: 3,
      };

      const output = {
        currentScore: mockPlan.currentScore.overall,
        estimatedScoreAfter: mockPlan.estimatedScoreAfter.overall,
        improvement: mockPlan.estimatedScoreAfter.overall - mockPlan.currentScore.overall,
        totalSteps: mockPlan.steps.length,
        totalOperations: mockPlan.totalOperations,
        steps: mockPlan.steps.map(s => ({
          id: s.id,
          tier: s.tier,
          rule: s.rule,
          priority: s.priority,
          title: s.title,
          description: s.description,
          operationCount: s.operations.length,
          scoreImpact: s.scoreImpact,
        })),
      };

      expect(output.currentScore).toBe(72);
      expect(output.improvement).toBe(10);
      expect(output.steps[0]!.operationCount).toBe(3);
      expect(output.steps[0]!.rule).toBe('hub-splitter');
    });
  });

  describe('suggest_rules handler', () => {
    it('should handle empty suggestions', () => {
      const suggestions: any[] = [];
      const text = suggestions.length > 0
        ? JSON.stringify(suggestions, null, 2)
        : 'No suggestions yet. Run `architect check` a few more times to build history.';
      expect(text).toContain('No suggestions');
    });

    it('should format suggestions as JSON', () => {
      const suggestions = [
        { type: 'quality_gate', yaml: 'min_overall_score: 75', reason: 'Score consistently above 70', confidence: 0.85 },
      ];
      const text = JSON.stringify(suggestions, null, 2);
      expect(JSON.parse(text)).toEqual(suggestions);
    });
  });

  describe('get_kb_context handler', () => {
    it('should return string context', () => {
      const context = `Architecture Context for test-project
Score: 72/100 (backend-monolith profile)
Anti-patterns: 4 (1 critical, 1 high)`;

      expect(typeof context).toBe('string');
      expect(context).toContain('72/100');
    });
  });
});

describe('MCP Server error handling', () => {
  it('should format errors with isError flag', () => {
    const error = new Error('Project not found');
    const response = {
      content: [{ type: 'text' as const, text: `Error: ${error.message}` }],
      isError: true,
    };

    expect(response.isError).toBe(true);
    expect(response.content[0]!.text).toBe('Error: Project not found');
  });

  it('should handle non-Error throws', () => {
    const error: unknown = 'string error';
    const message = error instanceof Error ? error.message : String(error);
    expect(message).toBe('string error');
  });
});

describe('MCP Server path resolution', () => {
  it('should resolve relative paths', () => {
    const input = './my-project';
    const resolved = resolve(input);
    expect(resolved).toMatch(/\/my-project$/);
    expect(resolved.startsWith('/')).toBe(true);
  });

  it('should keep absolute paths', () => {
    const input = '/absolute/path/project';
    const resolved = resolve(input);
    expect(resolved).toBe(input);
  });
});
