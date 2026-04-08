/**
 * Architecture Knowledge Base
 *
 * SQLite-backed persistence layer for architecture analysis data.
 * Zero-config: creates the database file automatically on first use.
 *
 * Usage:
 *   const kb = new KnowledgeBase('/path/to/project');
 *   kb.persistAnalysis(report);
 *   const history = kb.getScoreHistory(projectId);
 *   kb.close();
 *
 * @since v9.0.0 — Phase 1A
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { KB_SCHEMA, KB_SCHEMA_VERSION } from './schema.js';
import type { AnalysisReport, AntiPattern, DependencyEdge } from '../types/core.js';
import type { ValidationResult } from '../types/architect-rules.js';
import type { WeatherForecast } from '../analyzers/forecast.js';

// ── Public query result types ──────────────────────────────

export interface ProjectRecord {
  id: number;
  path: string;
  name: string;
  primaryLanguages: string[];
  frameworks: string[];
  totalFiles: number;
  totalLines: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisRecord {
  id: number;
  projectId: number;
  timestamp: string;
  score: {
    overall: number;
    modularity: number;
    coupling: number;
    cohesion: number;
    layering: number;
  };
  totalNodes: number;
  totalEdges: number;
  antiPatternCount: number;
  createdAt: string;
}

export interface ScorePoint {
  timestamp: string;
  overall: number;
  modularity: number;
  coupling: number;
  cohesion: number;
  layering: number;
}

export interface AntiPatternTrend {
  name: string;
  severity: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
}

export interface KBStats {
  totalProjects: number;
  totalAnalyses: number;
  totalAntiPatterns: number;
  totalDecisions: number;
  totalForecasts: number;
  dbSizeBytes: number;
}

export interface DecisionRecord {
  id: number;
  projectId: number;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context: string | null;
  decision: string | null;
  consequences: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Default KB location ────────────────────────────────────

const KB_DIR = '.architect';
const KB_FILE = 'knowledge-base.sqlite';

// ── KnowledgeBase class ────────────────────────────────────

export class KnowledgeBase {
  private db: Database.Database;
  private dbPath: string;

  /**
   * @param projectRoot - Root path of the project (KB stored in .architect/)
   * @param dbPath - Optional custom DB path (for testing)
   */
  constructor(projectRoot: string, dbPath?: string) {
    this.dbPath = dbPath ?? join(projectRoot, KB_DIR, KB_FILE);

    // Ensure directory exists
    const dir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);

    // Performance pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.initializeSchema();
  }

  // ── Schema management ──────────────────────────────────

  private initializeSchema(): void {
    const currentVersion = this.getSchemaVersion();

    if (currentVersion === 0) {
      // Fresh database
      this.db.exec(KB_SCHEMA);
      this.setSchemaVersion(KB_SCHEMA_VERSION);
    } else if (currentVersion < KB_SCHEMA_VERSION) {
      // Future: migration logic
      this.migrate(currentVersion, KB_SCHEMA_VERSION);
    }
  }

  private getSchemaVersion(): number {
    try {
      const row = this.db.prepare(
        `SELECT value FROM kb_meta WHERE key = 'schema_version'`
      ).get() as { value: string } | undefined;
      return row ? parseInt(row.value, 10) : 0;
    } catch {
      return 0;
    }
  }

  private setSchemaVersion(version: number): void {
    this.db.prepare(
      `INSERT OR REPLACE INTO kb_meta (key, value) VALUES ('schema_version', ?)`
    ).run(String(version));
  }

  private migrate(_from: number, _to: number): void {
    // Placeholder for future migrations
    // Each migration step should be idempotent
    this.db.exec(KB_SCHEMA);
    this.setSchemaVersion(_to);
  }

  // ── Project operations ─────────────────────────────────

  /**
   * Upsert a project record. Returns the project ID.
   */
  upsertProject(report: AnalysisReport): number {
    const info = report.projectInfo;
    const existing = this.db.prepare(
      `SELECT id FROM projects WHERE path = ?`
    ).get(info.path) as { id: number } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE projects SET
          name = ?,
          primary_languages = ?,
          frameworks = ?,
          total_files = ?,
          total_lines = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        info.name,
        JSON.stringify(info.primaryLanguages),
        JSON.stringify(info.frameworks),
        info.totalFiles,
        info.totalLines,
        existing.id
      );
      return existing.id;
    }

    const result = this.db.prepare(`
      INSERT INTO projects (path, name, primary_languages, frameworks, total_files, total_lines)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      info.path,
      info.name,
      JSON.stringify(info.primaryLanguages),
      JSON.stringify(info.frameworks),
      info.totalFiles,
      info.totalLines
    );

    return Number(result.lastInsertRowid);
  }

  getProject(projectId: number): ProjectRecord | null {
    const row = this.db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as any;
    return row ? this.mapProjectRow(row) : null;
  }

  getProjectByPath(path: string): ProjectRecord | null {
    const row = this.db.prepare(`SELECT * FROM projects WHERE path = ?`).get(path) as any;
    return row ? this.mapProjectRow(row) : null;
  }

  listProjects(): ProjectRecord[] {
    const rows = this.db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`).all() as any[];
    return rows.map(r => this.mapProjectRow(r));
  }

  private mapProjectRow(row: any): ProjectRecord {
    return {
      id: row.id,
      path: row.path,
      name: row.name,
      primaryLanguages: JSON.parse(row.primary_languages || '[]'),
      frameworks: JSON.parse(row.frameworks || '[]'),
      totalFiles: row.total_files,
      totalLines: row.total_lines,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ── Analysis persistence ───────────────────────────────

  /**
   * Persist a full AnalysisReport. Returns the analysis ID.
   * This is the primary entry point — call after `architect analyze`.
   */
  persistAnalysis(report: AnalysisReport): number {
    const projectId = this.upsertProject(report);

    const persist = this.db.transaction(() => {
      // Insert analysis record
      const result = this.db.prepare(`
        INSERT INTO analyses (
          project_id, timestamp,
          score_overall, score_modularity, score_coupling, score_cohesion, score_layering,
          score_components,
          total_nodes, total_edges,
          layers, suggestions,
          diagram_mermaid, diagram_type,
          full_report
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        report.timestamp,
        report.score.overall,
        report.score.breakdown.modularity,
        report.score.breakdown.coupling,
        report.score.breakdown.cohesion,
        report.score.breakdown.layering,
        JSON.stringify(report.score.components),
        report.dependencyGraph.nodes.length,
        report.dependencyGraph.edges.length,
        JSON.stringify(report.layers),
        JSON.stringify(report.suggestions),
        report.diagram?.mermaid ?? null,
        report.diagram?.type ?? null,
        JSON.stringify(report)
      );

      const analysisId = Number(result.lastInsertRowid);

      // Insert anti-patterns
      if (report.antiPatterns.length > 0) {
        const insertAp = this.db.prepare(`
          INSERT INTO anti_patterns (
            analysis_id, name, severity, location, description, suggestion, affected_files, metrics
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const ap of report.antiPatterns) {
          insertAp.run(
            analysisId,
            ap.name,
            ap.severity,
            ap.location,
            ap.description,
            ap.suggestion,
            ap.affectedFiles ? JSON.stringify(ap.affectedFiles) : null,
            ap.metrics ? JSON.stringify(ap.metrics) : null
          );
        }
      }

      // Insert dependency edges
      if (report.dependencyGraph.edges.length > 0) {
        const insertDep = this.db.prepare(`
          INSERT INTO dependencies (analysis_id, source_file, target_file, dep_type, weight)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const edge of report.dependencyGraph.edges) {
          insertDep.run(analysisId, edge.from, edge.to, edge.type, edge.weight);
        }
      }

      return analysisId;
    });

    return persist();
  }

  // ── Analysis queries ───────────────────────────────────

  /**
   * Get the latest analysis for a project.
   */
  getLatestAnalysis(projectId: number): AnalysisRecord | null {
    const row = this.db.prepare(`
      SELECT a.*, COUNT(ap.id) as anti_pattern_count
      FROM analyses a
      LEFT JOIN anti_patterns ap ON ap.analysis_id = a.id
      WHERE a.project_id = ?
      GROUP BY a.id
      ORDER BY a.timestamp DESC
      LIMIT 1
    `).get(projectId) as any;

    return row ? this.mapAnalysisRow(row) : null;
  }

  /**
   * List all analyses for a project, newest first.
   */
  listAnalyses(projectId: number, limit = 50): AnalysisRecord[] {
    const rows = this.db.prepare(`
      SELECT a.*, COUNT(ap.id) as anti_pattern_count
      FROM analyses a
      LEFT JOIN anti_patterns ap ON ap.analysis_id = a.id
      WHERE a.project_id = ?
      GROUP BY a.id
      ORDER BY a.timestamp DESC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map(r => this.mapAnalysisRow(r));
  }

  /**
   * Get the full AnalysisReport JSON from a specific analysis.
   */
  getFullReport(analysisId: number): AnalysisReport | null {
    const row = this.db.prepare(
      `SELECT full_report FROM analyses WHERE id = ?`
    ).get(analysisId) as { full_report: string } | undefined;

    return row ? JSON.parse(row.full_report) : null;
  }

  private mapAnalysisRow(row: any): AnalysisRecord {
    return {
      id: row.id,
      projectId: row.project_id,
      timestamp: row.timestamp,
      score: {
        overall: row.score_overall,
        modularity: row.score_modularity,
        coupling: row.score_coupling,
        cohesion: row.score_cohesion,
        layering: row.score_layering,
      },
      totalNodes: row.total_nodes,
      totalEdges: row.total_edges,
      antiPatternCount: row.anti_pattern_count ?? 0,
      createdAt: row.created_at,
    };
  }

  // ── Score history ──────────────────────────────────────

  /**
   * Get score timeline for trend visualization.
   */
  getScoreHistory(projectId: number, limit = 100): ScorePoint[] {
    const rows = this.db.prepare(`
      SELECT timestamp, score_overall, score_modularity, score_coupling, score_cohesion, score_layering
      FROM analyses
      WHERE project_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `).all(projectId, limit) as any[];

    return rows.map(r => ({
      timestamp: r.timestamp,
      overall: r.score_overall,
      modularity: r.score_modularity,
      coupling: r.score_coupling,
      cohesion: r.score_cohesion,
      layering: r.score_layering,
    }));
  }

  /**
   * Get score delta between latest and previous analysis.
   */
  getScoreDelta(projectId: number): { current: number; previous: number; delta: number } | null {
    const rows = this.db.prepare(`
      SELECT score_overall FROM analyses
      WHERE project_id = ?
      ORDER BY timestamp DESC
      LIMIT 2
    `).all(projectId) as { score_overall: number }[];

    if (rows.length < 2) return null;
    const current = rows[0]!;
    const previous = rows[1]!;
    return {
      current: current.score_overall,
      previous: previous.score_overall,
      delta: current.score_overall - previous.score_overall,
    };
  }

  // ── Anti-pattern queries ───────────────────────────────

  /**
   * Get anti-patterns for a specific analysis.
   */
  getAntiPatterns(analysisId: number): AntiPattern[] {
    const rows = this.db.prepare(`
      SELECT * FROM anti_patterns WHERE analysis_id = ?
    `).all(analysisId) as any[];

    return rows.map(r => ({
      name: r.name,
      severity: r.severity,
      location: r.location,
      description: r.description,
      suggestion: r.suggestion,
      affectedFiles: r.affected_files ? JSON.parse(r.affected_files) : undefined,
      metrics: r.metrics ? JSON.parse(r.metrics) : undefined,
    }));
  }

  /**
   * Track anti-pattern trends across analyses.
   */
  getAntiPatternTrends(projectId: number): AntiPatternTrend[] {
    const rows = this.db.prepare(`
      SELECT
        ap.name,
        ap.severity,
        COUNT(*) as occurrences,
        MIN(a.timestamp) as first_seen,
        MAX(a.timestamp) as last_seen
      FROM anti_patterns ap
      JOIN analyses a ON a.id = ap.analysis_id
      WHERE a.project_id = ?
      GROUP BY ap.name, ap.severity
      ORDER BY occurrences DESC
    `).all(projectId) as any[];

    return rows.map(r => ({
      name: r.name,
      severity: r.severity,
      occurrences: r.occurrences,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
    }));
  }

  // ── Dependency queries ─────────────────────────────────

  /**
   * Get top hub files (highest fan-in) from latest analysis.
   */
  getTopHubs(analysisId: number, limit = 10): { file: string; fanIn: number }[] {
    const rows = this.db.prepare(`
      SELECT target_file as file, COUNT(*) as fan_in
      FROM dependencies
      WHERE analysis_id = ?
      GROUP BY target_file
      ORDER BY fan_in DESC
      LIMIT ?
    `).all(analysisId, limit) as any[];

    return rows.map(r => ({ file: r.file, fanIn: r.fan_in }));
  }

  /**
   * Get dependencies for a specific file.
   */
  getFileDependencies(analysisId: number, filePath: string): {
    imports: DependencyEdge[];
    importedBy: DependencyEdge[];
  } {
    const imports = this.db.prepare(`
      SELECT source_file as 'from', target_file as 'to', dep_type as type, weight
      FROM dependencies
      WHERE analysis_id = ? AND source_file = ?
    `).all(analysisId, filePath) as DependencyEdge[];

    const importedBy = this.db.prepare(`
      SELECT source_file as 'from', target_file as 'to', dep_type as type, weight
      FROM dependencies
      WHERE analysis_id = ? AND target_file = ?
    `).all(analysisId, filePath) as DependencyEdge[];

    return { imports, importedBy };
  }

  // ── ADR (Architecture Decision Records) ────────────────

  addDecision(projectId: number, decision: {
    title: string;
    status?: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
    context?: string;
    decision?: string;
    consequences?: string;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO decisions (project_id, title, status, context, decision, consequences)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      decision.title,
      decision.status ?? 'proposed',
      decision.context ?? null,
      decision.decision ?? null,
      decision.consequences ?? null
    );
    return Number(result.lastInsertRowid);
  }

  listDecisions(projectId: number): DecisionRecord[] {
    return this.db.prepare(`
      SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at DESC
    `).all(projectId) as DecisionRecord[];
  }

  updateDecisionStatus(decisionId: number, status: DecisionRecord['status']): void {
    this.db.prepare(`
      UPDATE decisions SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, decisionId);
  }

  // ── Validation persistence ─────────────────────────────

  persistValidation(analysisId: number, result: ValidationResult): number {
    const r = this.db.prepare(`
      INSERT INTO validations (analysis_id, success, violations)
      VALUES (?, ?, ?)
    `).run(
      analysisId,
      result.success ? 1 : 0,
      JSON.stringify(result.violations)
    );
    return Number(r.lastInsertRowid);
  }

  // ── Forecast persistence ───────────────────────────────

  persistForecast(projectId: number, forecast: WeatherForecast, decay?: {
    current: number;
    predicted: number;
    delta: number;
    confidence: number;
  }): number {
    const result = this.db.prepare(`
      INSERT INTO forecasts (
        project_id, generated_at, overall_outlook, headline, modules,
        decay_current, decay_predicted, decay_delta, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      projectId,
      forecast.generatedAt,
      forecast.overallOutlook,
      forecast.headline,
      JSON.stringify(forecast.modules),
      decay?.current ?? null,
      decay?.predicted ?? null,
      decay?.delta ?? null,
      decay?.confidence ?? null
    );
    return Number(result.lastInsertRowid);
  }

  // ── Stats & export ─────────────────────────────────────

  getStats(): KBStats {
    const counts = this.db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(*) FROM analyses) as total_analyses,
        (SELECT COUNT(*) FROM anti_patterns) as total_anti_patterns,
        (SELECT COUNT(*) FROM decisions) as total_decisions,
        (SELECT COUNT(*) FROM forecasts) as total_forecasts
    `).get() as any;

    // Get DB file size
    const pageCountArr = this.db.pragma('page_count') as { page_count: number }[];
    const pageSizeArr = this.db.pragma('page_size') as { page_size: number }[];
    const pageCount = pageCountArr.length > 0 ? pageCountArr[0]!.page_count : 0;
    const pageSize = pageSizeArr.length > 0 ? pageSizeArr[0]!.page_size : 4096;

    return {
      totalProjects: counts.total_projects,
      totalAnalyses: counts.total_analyses,
      totalAntiPatterns: counts.total_anti_patterns,
      totalDecisions: counts.total_decisions,
      totalForecasts: counts.total_forecasts,
      dbSizeBytes: pageCount * pageSize,
    };
  }

  /**
   * Export full project history as JSON (for LLM context or external tools).
   */
  exportProjectHistory(projectId: number): {
    project: ProjectRecord;
    analyses: AnalysisRecord[];
    scoreHistory: ScorePoint[];
    antiPatternTrends: AntiPatternTrend[];
    decisions: DecisionRecord[];
  } | null {
    const project = this.getProject(projectId);
    if (!project) return null;

    return {
      project,
      analyses: this.listAnalyses(projectId),
      scoreHistory: this.getScoreHistory(projectId),
      antiPatternTrends: this.getAntiPatternTrends(projectId),
      decisions: this.listDecisions(projectId),
    };
  }

  /**
   * Generate a text summary suitable for LLM context injection.
   */
  generateLLMContext(projectId: number): string {
    const history = this.exportProjectHistory(projectId);
    if (!history) return 'No data available for this project.';

    const { project, analyses, scoreHistory, antiPatternTrends } = history;
    const latest = analyses[0];

    const lines: string[] = [
      `# Architecture Knowledge Base: ${project.name}`,
      `Path: ${project.path}`,
      `Languages: ${project.primaryLanguages.join(', ')}`,
      `Frameworks: ${project.frameworks.join(', ')}`,
      `Files: ${project.totalFiles} | Lines: ${project.totalLines}`,
      '',
      `## Current Score (${latest?.timestamp ?? 'N/A'})`,
    ];

    if (latest) {
      lines.push(
        `Overall: ${latest.score.overall.toFixed(1)}/100`,
        `  Modularity: ${latest.score.modularity.toFixed(1)}`,
        `  Coupling: ${latest.score.coupling.toFixed(1)}`,
        `  Cohesion: ${latest.score.cohesion.toFixed(1)}`,
        `  Layering: ${latest.score.layering.toFixed(1)}`,
        `Anti-patterns: ${latest.antiPatternCount}`,
        `Nodes: ${latest.totalNodes} | Edges: ${latest.totalEdges}`,
      );
    }

    if (scoreHistory.length > 1) {
      lines.push('', '## Score Trend');
      const first = scoreHistory[0]!;
      const last = scoreHistory[scoreHistory.length - 1]!;
      const delta = last.overall - first.overall;
      lines.push(
        `${scoreHistory.length} analyses from ${first.timestamp} to ${last.timestamp}`,
        `Trend: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} points (${first.overall.toFixed(1)} → ${last.overall.toFixed(1)})`,
      );
    }

    if (antiPatternTrends.length > 0) {
      lines.push('', '## Recurring Anti-Patterns');
      for (const ap of antiPatternTrends.slice(0, 10)) {
        lines.push(`- ${ap.name} [${ap.severity}]: ${ap.occurrences}x (${ap.firstSeen} → ${ap.lastSeen})`);
      }
    }

    return lines.join('\n');
  }

  // ── Lifecycle ──────────────────────────────────────────

  /**
   * Close the database connection. Call when done.
   */
  close(): void {
    this.db.close();
  }

  /**
   * Get the database file path (for diagnostics).
   */
  getDatabasePath(): string {
    return this.dbPath;
  }
}
