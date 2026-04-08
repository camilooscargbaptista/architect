#!/usr/bin/env node

/**
 * Architect MCP Server
 *
 * Exposes Architect Genesis as a set of MCP tools that any LLM can call.
 * Works with Claude Code, Cursor, Windsurf, and any MCP-compatible client.
 *
 * Tools exposed:
 *   - analyze_project: Full architecture analysis
 *   - get_score: Quick score lookup
 *   - check_rules: Validate against .architect.rules.yml
 *   - get_anti_patterns: List detected anti-patterns
 *   - query_kb: Query the Knowledge Base
 *   - suggest_refactoring: Get refactoring suggestions
 *   - suggest_rules: Get rule suggestions from KB history
 *   - get_kb_context: Generate LLM-ready architecture context
 *
 * @since v10.0.0 — Phase 2C
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'path';

// ── Lazy imports for architect-core (avoid startup penalty) ──

async function getArchitectCore() {
  const [
    { ArchitectureAnalyzer },
    { ArchitectureScorer },
    { AntiPatternDetector },
    { RefactorEngine },
    { RulesEngine },
    { KnowledgeBase },
    { ConfigLoader },
    { ProjectScanner },
    { resolveProfile, mergeWeights },
    { suggestRules },
  ] = await Promise.all([
    import('@girardelli/architect-core/src/core/analyzer.js'),
    import('@girardelli/architect-core/src/core/scorer.js'),
    import('@girardelli/architect-core/src/core/anti-patterns.js'),
    import('@girardelli/architect-core/src/core/refactor-engine.js'),
    import('@girardelli/architect-core/src/core/rules-engine.js'),
    import('@girardelli/architect-core/src/core/knowledge-base/knowledge-base.js'),
    import('@girardelli/architect-core/src/core/config.js'),
    import('@girardelli/architect-core/src/infrastructure/scanner.js'),
    import('@girardelli/architect-core/src/core/scoring-profiles.js'),
    import('@girardelli/architect-core/src/core/self-improving-loop.js'),
  ]);

  return {
    ArchitectureAnalyzer, ArchitectureScorer, AntiPatternDetector,
    RefactorEngine, RulesEngine, KnowledgeBase, ConfigLoader,
    ProjectScanner, resolveProfile, mergeWeights, suggestRules,
  };
}

// ── Helper: run full analysis ────────────────────────────

async function runAnalysis(projectPath: string) {
  const core = await getArchitectCore();
  const absPath = resolve(projectPath);
  const config = core.ConfigLoader.loadConfig(absPath);
  const scanner = new core.ProjectScanner(absPath, config);
  const projectInfo = scanner.scan();

  if (!projectInfo.fileTree) throw new Error('Failed to scan project');

  const analyzer = new core.ArchitectureAnalyzer(absPath);
  await analyzer.initialize();

  const edges = analyzer.analyzeDependencies(projectInfo.fileTree);
  const layers = analyzer.detectLayers(projectInfo.fileTree);

  const dependencies = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!dependencies.has(edge.from)) dependencies.set(edge.from, new Set());
    dependencies.get(edge.from)!.add(edge.to);
  }

  const detector = new core.AntiPatternDetector(config);
  const antiPatterns = await detector.detect(projectInfo.fileTree, dependencies);

  const profile = core.resolveProfile({
    frameworks: projectInfo.frameworks,
    languages: projectInfo.primaryLanguages,
  });
  const weights = core.mergeWeights(profile, config.score);
  const scorer = new core.ArchitectureScorer(weights, profile.thresholds, profile.name);
  const score = scorer.score(edges, antiPatterns, projectInfo.totalFiles);

  const nodes = Array.from(new Set([...edges.map(e => e.from), ...edges.map(e => e.to)]));

  return {
    timestamp: new Date().toISOString(),
    projectInfo,
    score,
    antiPatterns,
    layers,
    dependencyGraph: { nodes, edges },
    suggestions: [],
    diagram: { mermaid: '', type: 'dependency' as const },
    profile: profile.name,
  };
}

// ── MCP Server setup ─────────────────────────────────────

const server = new McpServer({
  name: 'architect',
  version: '10.0.0',
});

// Tool 1: analyze_project
server.tool(
  'analyze_project',
  'Run full architecture analysis on a project. Returns score, anti-patterns, layers, and dependency graph stats.',
  { projectPath: z.string().describe('Absolute or relative path to the project root') },
  async ({ projectPath }) => {
    try {
      const report = await runAnalysis(projectPath);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
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
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 2: get_score
server.tool(
  'get_score',
  'Get the architecture score (0-100) for a project. Quick check without full report.',
  { projectPath: z.string().describe('Path to the project root') },
  async ({ projectPath }) => {
    try {
      const report = await runAnalysis(projectPath);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            overall: report.score.overall,
            breakdown: report.score.breakdown,
            profile: report.profile,
          }),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 3: get_anti_patterns
server.tool(
  'get_anti_patterns',
  'List all detected anti-patterns in a project with severity, location, and fix suggestions.',
  { projectPath: z.string().describe('Path to the project root') },
  async ({ projectPath }) => {
    try {
      const report = await runAnalysis(projectPath);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(report.antiPatterns, null, 2),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 4: check_rules
server.tool(
  'check_rules',
  'Validate a project against its .architect.rules.yml governance rules. Returns pass/fail with violations.',
  { projectPath: z.string().describe('Path to the project root') },
  async ({ projectPath }) => {
    try {
      const core = await getArchitectCore();
      const absPath = resolve(projectPath);
      const { readFileSync, existsSync } = await import('fs');
      const { join } = await import('path');
      const yaml = await import('yaml');

      const rulesPath = join(absPath, '.architect.rules.yml');
      if (!existsSync(rulesPath)) {
        return { content: [{ type: 'text' as const, text: 'No .architect.rules.yml found. Create one to define governance rules.' }] };
      }

      const rules = yaml.parse(readFileSync(rulesPath, 'utf8'));
      const report = await runAnalysis(projectPath);
      const engine = new core.RulesEngine();
      const result = engine.validate(report as any, rules);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: result.success,
            score: report.score.overall,
            violationCount: result.violations.length,
            violations: result.violations,
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 5: query_kb
server.tool(
  'query_kb',
  'Query the Architecture Knowledge Base. Returns project history, score trends, and anti-pattern trends.',
  {
    projectPath: z.string().describe('Path to the project root'),
    query: z.enum(['history', 'trends', 'stats', 'latest']).describe('What to query: history (score timeline), trends (anti-pattern trends), stats (KB stats), latest (most recent analysis)'),
  },
  async ({ projectPath, query }) => {
    try {
      const core = await getArchitectCore();
      const absPath = resolve(projectPath);
      const kb = new core.KnowledgeBase(absPath);

      try {
        const project = kb.getProjectByPath(absPath);
        if (!project) {
          return { content: [{ type: 'text' as const, text: 'No KB data for this project. Run `architect analyze` first.' }] };
        }

        let result: any;
        switch (query) {
          case 'history':
            result = kb.getScoreHistory(project.id);
            break;
          case 'trends':
            result = kb.getAntiPatternTrends(project.id);
            break;
          case 'stats':
            result = kb.getStats();
            break;
          case 'latest':
            result = kb.getLatestAnalysis(project.id);
            break;
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } finally {
        kb.close();
      }
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 6: suggest_refactoring
server.tool(
  'suggest_refactoring',
  'Generate a refactoring plan for a project. Returns prioritized steps with file operations and score impact.',
  { projectPath: z.string().describe('Path to the project root') },
  async ({ projectPath }) => {
    try {
      const core = await getArchitectCore();
      const report = await runAnalysis(projectPath);
      const engine = new core.RefactorEngine();
      const plan = engine.analyze(report as any, resolve(projectPath));

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            currentScore: plan.currentScore.overall,
            estimatedScoreAfter: plan.estimatedScoreAfter.overall,
            improvement: plan.estimatedScoreAfter.overall - plan.currentScore.overall,
            totalSteps: plan.steps.length,
            totalOperations: plan.totalOperations,
            steps: plan.steps.map(s => ({
              id: s.id,
              tier: s.tier,
              rule: s.rule,
              priority: s.priority,
              title: s.title,
              description: s.description,
              operationCount: s.operations.length,
              scoreImpact: s.scoreImpact,
            })),
          }, null, 2),
        }],
      };
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 7: suggest_rules
server.tool(
  'suggest_rules',
  'Suggest governance rules based on KB history. Returns YAML snippets to add to .architect.rules.yml.',
  { projectPath: z.string().describe('Path to the project root') },
  async ({ projectPath }) => {
    try {
      const core = await getArchitectCore();
      const absPath = resolve(projectPath);
      const kb = new core.KnowledgeBase(absPath);

      try {
        const suggestions = core.suggestRules(kb, absPath);
        return {
          content: [{
            type: 'text' as const,
            text: suggestions.length > 0
              ? JSON.stringify(suggestions, null, 2)
              : 'No suggestions yet. Run `architect check` a few more times to build history.',
          }],
        };
      } finally {
        kb.close();
      }
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// Tool 8: get_kb_context
server.tool(
  'get_kb_context',
  'Generate a text summary of the project architecture suitable for LLM context injection. Includes score, trends, and recurring patterns.',
  { projectPath: z.string().describe('Path to the project root') },
  async ({ projectPath }) => {
    try {
      const core = await getArchitectCore();
      const absPath = resolve(projectPath);
      const kb = new core.KnowledgeBase(absPath);

      try {
        const project = kb.getProjectByPath(absPath);
        if (!project) {
          return { content: [{ type: 'text' as const, text: 'No KB data. Run `architect analyze` first.' }] };
        }

        const context = kb.generateLLMContext(project.id);
        return { content: [{ type: 'text' as const, text: context }] };
      } finally {
        kb.close();
      }
    } catch (err: any) {
      return { content: [{ type: 'text' as const, text: `Error: ${err.message}` }], isError: true };
    }
  }
);

// ── Start server ─────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Architect MCP Server running on stdio');
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
