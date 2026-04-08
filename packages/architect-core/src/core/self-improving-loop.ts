/**
 * Self-Improving Loop
 *
 * When violations are detected, the system:
 *   1. Persists the violation as a constraint in the KB
 *   2. Analyzes violation patterns over time
 *   3. Suggests new rules for .architect.rules.yml
 *
 * This turns the Architect from a passive tool into one that
 * learns from each run and progressively tightens governance.
 *
 * @since v10.0.0 — Phase 2A
 */

import { architectEvents, ViolationDetectedEvent, AnalysisCompletedEvent, ScoreDegradedEvent } from './events.js';
import { KnowledgeBase } from './knowledge-base/knowledge-base.js';
import type { RuleViolation } from './types/architect-rules.js';

// ── Types ────────────────────────────────────────────────

export interface RuleSuggestion {
  type: 'quality_gate' | 'boundary' | 'anti_pattern_limit';
  yaml: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
  basedOn: string;  // what data drove the suggestion
}

// ── Violation handler ────────────────────────────────────

/**
 * Register event listeners that enable the self-improving loop.
 * Call once during CLI startup.
 */
export function registerSelfImprovingLoop(kb: KnowledgeBase, _projectPath: string): () => void {
  const unsubs: (() => void)[] = [];

  // 1. On violation → persist as constraint in KB
  unsubs.push(
    architectEvents.on('violation.detected', (event: ViolationDetectedEvent) => {
      try {
        const project = kb.getProjectByPath(event.projectPath);
        if (!project) return;

        // Check if this constraint already exists
        const existingConstraints = getActiveConstraints(kb, project.id);
        const alreadyExists = existingConstraints.some(
          c => c.ruleType === event.violation.rule
        );

        if (!alreadyExists) {
          persistConstraint(kb, project.id, event.violation);
        }
      } catch {
        // KB errors should not break the flow
      }
    })
  );

  // 2. On analysis completed → check for score degradation
  unsubs.push(
    architectEvents.on('analysis.completed', (event: AnalysisCompletedEvent) => {
      try {
        const project = kb.getProjectByPath(event.projectPath);
        if (!project) return;

        const delta = kb.getScoreDelta(project.id);
        if (delta && delta.delta < -3) {
          // Score dropped by more than 3 points → emit degradation event
          architectEvents.emit({
            type: 'score.degraded',
            timestamp: new Date().toISOString(),
            projectPath: event.projectPath,
            previousScore: delta.previous,
            currentScore: delta.current,
            delta: delta.delta,
          });
        }
      } catch {
        // Silent
      }
    })
  );

  // 3. On score degraded → persist constraint to prevent further decay
  unsubs.push(
    architectEvents.on('score.degraded', (event: ScoreDegradedEvent) => {
      try {
        const project = kb.getProjectByPath(event.projectPath);
        if (!project) return;

        // Create a constraint to hold the line at the new score + small buffer
        const minScore = Math.floor(event.currentScore - 2);
        persistConstraint(kb, project.id, {
          level: 'warning',
          rule: 'auto.min_score_floor',
          message: `Auto-generated: score dropped from ${event.previousScore.toFixed(1)} to ${event.currentScore.toFixed(1)}`,
          actual: event.currentScore,
          expected: minScore,
        });
      } catch {
        // Silent
      }
    })
  );

  // Return cleanup function
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

// ── Constraint persistence ───────────────────────────────

function persistConstraint(
  kb: KnowledgeBase,
  projectId: number,
  violation: RuleViolation,
): void {
  const db = (kb as any).db;
  if (!db) return;

  db.prepare(`
    INSERT INTO constraints (project_id, rule_type, definition, active)
    VALUES (?, ?, ?, 1)
  `).run(
    projectId,
    violation.rule,
    JSON.stringify({
      level: violation.level,
      rule: violation.rule,
      message: violation.message,
      actual: violation.actual,
      expected: violation.expected,
      detectedAt: new Date().toISOString(),
    }),
  );
}

interface ConstraintRecord {
  id: number;
  ruleType: string;
  definition: any;
  active: boolean;
}

function getActiveConstraints(kb: KnowledgeBase, projectId: number): ConstraintRecord[] {
  const db = (kb as any).db;
  if (!db) return [];

  const rows = db.prepare(`
    SELECT id, rule_type, definition, active
    FROM constraints
    WHERE project_id = ? AND active = 1
  `).all(projectId) as any[];

  return rows.map((r: any) => ({
    id: r.id,
    ruleType: r.rule_type,
    definition: JSON.parse(r.definition),
    active: r.active === 1,
  }));
}

// ── Rule suggestion engine ───────────────────────────────

/**
 * Analyze KB history and generate rule suggestions for .architect.rules.yml.
 *
 * Strategies:
 *   1. If score consistently above threshold → suggest raising min_overall_score
 *   2. If an anti-pattern appears in 3+ analyses → suggest max limit
 *   3. If circular deps keep appearing → suggest banning them
 *   4. If specific imports keep violating → suggest banned_imports
 */
export function suggestRules(kb: KnowledgeBase, projectPath: string): RuleSuggestion[] {
  const project = kb.getProjectByPath(projectPath);
  if (!project) return [];

  const suggestions: RuleSuggestion[] = [];
  const analyses = kb.listAnalyses(project.id, 20);
  const scoreHistory = kb.getScoreHistory(project.id, 20);
  const apTrends = kb.getAntiPatternTrends(project.id);

  if (analyses.length < 2) return suggestions; // Need history

  // Strategy 1: Raise min_overall_score to lock in gains
  if (scoreHistory.length >= 3) {
    const recent = scoreHistory.slice(-5);
    const minRecent = Math.min(...recent.map(s => s.overall));
    const avgRecent = recent.reduce((s, p) => s + p.overall, 0) / recent.length;

    if (minRecent >= 60 && avgRecent >= 65) {
      const suggestedMin = Math.floor(minRecent - 5);
      suggestions.push({
        type: 'quality_gate',
        yaml: `quality_gates:\n  min_overall_score: ${suggestedMin}`,
        reason: `Your score has been consistently above ${minRecent.toFixed(0)} in the last ${recent.length} analyses. Lock in the gain with a quality gate.`,
        confidence: avgRecent >= 70 ? 'high' : 'medium',
        basedOn: `${recent.length} recent analyses, min=${minRecent.toFixed(1)}, avg=${avgRecent.toFixed(1)}`,
      });
    }
  }

  // Strategy 2: Limit recurring anti-patterns
  for (const ap of apTrends) {
    if (ap.occurrences >= 3 && (ap.severity === 'CRITICAL' || ap.severity === 'HIGH')) {
      if (ap.name === 'Circular Dependency') {
        suggestions.push({
          type: 'boundary',
          yaml: `boundaries:\n  allow_circular_dependencies: false`,
          reason: `Circular dependencies detected in ${ap.occurrences} out of ${analyses.length} analyses. Ban them to prevent accumulation.`,
          confidence: ap.occurrences >= 5 ? 'high' : 'medium',
          basedOn: `${ap.occurrences} occurrences since ${ap.firstSeen}`,
        });
      } else {
        const limit = ap.severity === 'CRITICAL' ? 0 : Math.max(0, Math.floor(ap.occurrences * 0.5));
        const key = ap.severity === 'CRITICAL' ? 'max_critical_anti_patterns' : 'max_high_anti_patterns';
        suggestions.push({
          type: 'anti_pattern_limit',
          yaml: `quality_gates:\n  ${key}: ${limit}`,
          reason: `"${ap.name}" (${ap.severity}) has appeared ${ap.occurrences} times. Set a limit to drive it down.`,
          confidence: ap.occurrences >= 5 ? 'high' : 'medium',
          basedOn: `${ap.occurrences} occurrences, severity=${ap.severity}`,
        });
      }
    }
  }

  // Strategy 3: Score stability — suggest coupling/modularity gates if components are weak
  if (analyses.length >= 3) {
    const latest = analyses[0]!;
    if (latest.score.coupling < 50) {
      suggestions.push({
        type: 'quality_gate',
        yaml: `# Consider adding per-dimension minimums (custom rule)\n# coupling_score_min: 50`,
        reason: `Coupling score is ${latest.score.coupling}. High coupling makes the codebase brittle.`,
        confidence: 'low',
        basedOn: `Latest coupling score: ${latest.score.coupling}`,
      });
    }
  }

  // Deduplicate by type
  const seen = new Set<string>();
  return suggestions.filter(s => {
    const key = `${s.type}:${s.yaml}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Emit events for all violations found in a validation result.
 * Call after RulesEngine.validate().
 */
export function emitViolationEvents(
  violations: RuleViolation[],
  projectPath: string,
  score: number,
  antiPatternCount: number,
): void {
  for (const v of violations) {
    const violation: ViolationDetectedEvent['violation'] = {
      level: v.level,
      rule: v.rule,
      message: v.message,
    };
    if (v.actual !== undefined) violation.actual = v.actual;
    if (v.expected !== undefined) violation.expected = v.expected;

    architectEvents.emit({
      type: 'violation.detected',
      timestamp: new Date().toISOString(),
      projectPath,
      violation,
      context: { score, antiPatternCount },
    });
  }
}

/**
 * Emit analysis completed event.
 */
export function emitAnalysisCompleted(
  projectPath: string,
  score: number,
  antiPatternCount: number,
  analysisId?: number,
): void {
  const event: AnalysisCompletedEvent = {
    type: 'analysis.completed',
    timestamp: new Date().toISOString(),
    projectPath,
    score,
    antiPatternCount,
  };
  if (analysisId !== undefined) event.analysisId = analysisId;
  architectEvents.emit(event);
}
