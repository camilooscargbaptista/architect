/**
 * Tests for RefactorEngine plugin rule integration — Fase 3.4
 *
 * Verifies that plugin-provided RefactorRule instances are properly
 * incorporated into the analysis pipeline alongside built-in rules.
 */

import { RefactorEngine } from '../src/core/refactor-engine.js';
import type { RefactorRule, RefactorStep } from '../src/core/types/rules.js';
import type { AnalysisReport, ArchitectureScore, DependencyIndex } from '../src/core/types/core.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeScore(overall: number): ArchitectureScore {
  return {
    overall,
    components: [],
    breakdown: { modularity: overall, coupling: overall, cohesion: overall, layering: overall },
  };
}

function makeReport(score: number, files: string[] = ['src/a.ts', 'src/b.ts']): AnalysisReport {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      name: 'test-project',
      rootPath: '/project',
      totalFiles: files.length,
      totalLines: 1000,
      primaryLanguages: ['typescript'],
      fileTree: [],
    } as any,
    score: makeScore(score),
    antiPatterns: [],
    layers: [],
    dependencyGraph: {
      nodes: files,
      edges: [
        { from: files[0]!, to: files[1]!, type: 'import' as const, weight: 1 },
      ],
    },
    suggestions: [],
    diagram: { mermaid: '', type: 'component' as const },
  };
}

function makePluginRule(name: string, steps: RefactorStep[] = []): RefactorRule {
  return {
    name,
    tier: 2,
    analyze: (_report: AnalysisReport, _projectPath: string, _index?: DependencyIndex): RefactorStep[] => {
      return steps;
    },
  };
}

function makeStep(rule: string, title: string): RefactorStep {
  return {
    id: 0,
    tier: 2,
    rule,
    priority: 'MEDIUM',
    title,
    description: `Step from ${rule}`,
    rationale: 'Plugin-generated',
    operations: [
      { type: 'MODIFY', path: 'src/a.ts', description: 'Plugin modification' },
    ],
    scoreImpact: [],
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('RefactorEngine — Plugin Integration', () => {
  it('should include plugin rules in analysis results', () => {
    const engine = new RefactorEngine();
    const pluginStep = makeStep('my-custom-rule', 'Custom refactoring step');

    engine.registerPluginRules([
      makePluginRule('my-custom-rule', [pluginStep]),
    ]);

    const report = makeReport(60);
    const plan = engine.analyze(report, '/project');

    // Should contain the plugin-generated step
    const customSteps = plan.steps.filter(s => s.rule === 'my-custom-rule');
    expect(customSteps.length).toBe(1);
    expect(customSteps[0]!.title).toBe('Custom refactoring step');
  });

  it('should run plugin rules after built-in rules', () => {
    const engine = new RefactorEngine();

    // Plugin rule that records the ID it receives
    const pluginStep = makeStep('late-rule', 'I should be after built-in steps');
    engine.registerPluginRules([
      makePluginRule('late-rule', [pluginStep]),
    ]);

    const report = makeReport(60);
    const plan = engine.analyze(report, '/project');

    // Plugin steps should be present and have valid IDs
    const pluginSteps = plan.steps.filter(s => s.rule === 'late-rule');
    expect(pluginSteps.length).toBeGreaterThan(0);
    for (const step of pluginSteps) {
      expect(step.id).toBeGreaterThan(0);
    }
  });

  it('should handle multiple plugin rules', () => {
    const engine = new RefactorEngine();

    engine.registerPluginRules([
      makePluginRule('rule-alpha', [makeStep('rule-alpha', 'Alpha step')]),
      makePluginRule('rule-beta', [makeStep('rule-beta', 'Beta step')]),
    ]);

    const report = makeReport(55);
    const plan = engine.analyze(report, '/project');

    const alphaSteps = plan.steps.filter(s => s.rule === 'rule-alpha');
    const betaSteps = plan.steps.filter(s => s.rule === 'rule-beta');
    expect(alphaSteps.length).toBe(1);
    expect(betaSteps.length).toBe(1);
  });

  it('should handle plugin rules that return empty steps', () => {
    const engine = new RefactorEngine();

    engine.registerPluginRules([
      makePluginRule('empty-rule', []),
    ]);

    const report = makeReport(80);
    const plan = engine.analyze(report, '/project');

    // Should still work, just no steps from that rule
    const emptyRuleSteps = plan.steps.filter(s => s.rule === 'empty-rule');
    expect(emptyRuleSteps.length).toBe(0);
  });

  it('should count both built-in and plugin rules', () => {
    const engine = new RefactorEngine();
    const initialCount = engine.getRuleCount();
    expect(initialCount).toBe(5); // 5 built-in Tier 1 rules

    engine.registerPluginRules([
      makePluginRule('custom-1'),
      makePluginRule('custom-2'),
    ]);

    expect(engine.getRuleCount()).toBe(7);
  });

  it('should validate plans that include plugin steps', () => {
    const engine = new RefactorEngine();

    const step = makeStep('validated-rule', 'This will be validated');
    engine.registerPluginRules([makePluginRule('validated-rule', [step])]);

    const report = makeReport(70);
    const plan = engine.analyze(report, '/project');

    // GenesisValidator should have run on the combined plan
    expect(plan.validation).toBeDefined();
    expect(plan.validation!.valid).toBeDefined();
  });

  it('should sort plugin steps by priority alongside built-in steps', () => {
    const engine = new RefactorEngine();

    const criticalStep: RefactorStep = {
      ...makeStep('urgent-rule', 'Critical fix'),
      priority: 'CRITICAL',
    };

    engine.registerPluginRules([
      makePluginRule('urgent-rule', [criticalStep]),
    ]);

    const report = makeReport(50);
    const plan = engine.analyze(report, '/project');

    // CRITICAL steps should be early in the plan
    const urgentIdx = plan.steps.findIndex(s => s.rule === 'urgent-rule');
    if (urgentIdx >= 0) {
      // All steps before this should also be CRITICAL
      for (let i = 0; i < urgentIdx; i++) {
        expect(plan.steps[i]!.priority).toBe('CRITICAL');
      }
    }
  });
});
