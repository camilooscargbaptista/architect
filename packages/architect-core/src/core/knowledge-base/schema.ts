/**
 * Architecture Knowledge Base — SQLite Schema
 *
 * Stores historical analysis data, enabling trend tracking,
 * cross-project comparison, and LLM-queryable architecture context.
 *
 * @since v9.0.0 — Phase 1A (Architecture Knowledge Base)
 */

export const KB_SCHEMA_VERSION = 1;

export const KB_SCHEMA = `
-- ────────────────────────────────────────────────────────────
-- Schema metadata
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kb_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ────────────────────────────────────────────────────────────
-- Projects — one row per analyzed codebase
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  path            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  primary_languages TEXT,          -- JSON array: ["typescript","python"]
  frameworks      TEXT,            -- JSON array: ["nextjs","express"]
  total_files     INTEGER DEFAULT 0,
  total_lines     INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────
-- Analyses — timestamped snapshots of a project analysis
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  timestamp       TEXT NOT NULL,
  -- Overall score
  score_overall   REAL NOT NULL,
  score_modularity REAL NOT NULL,
  score_coupling  REAL NOT NULL,
  score_cohesion  REAL NOT NULL,
  score_layering  REAL NOT NULL,
  -- Score components detail (JSON)
  score_components TEXT,
  -- Graph stats
  total_nodes     INTEGER DEFAULT 0,
  total_edges     INTEGER DEFAULT 0,
  -- Layers (JSON array of Layer objects)
  layers          TEXT,
  -- Suggestions (JSON array)
  suggestions     TEXT,
  -- Mermaid diagram
  diagram_mermaid TEXT,
  diagram_type    TEXT,
  -- Full report JSON (for export/LLM context)
  full_report     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analyses_project_time
  ON analyses(project_id, timestamp DESC);

-- ────────────────────────────────────────────────────────────
-- Anti-patterns — per analysis
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anti_patterns (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id     INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  severity        TEXT NOT NULL CHECK(severity IN ('CRITICAL','HIGH','MEDIUM','LOW')),
  location        TEXT NOT NULL,
  description     TEXT,
  suggestion      TEXT,
  affected_files  TEXT,           -- JSON array
  metrics         TEXT            -- JSON object
);

CREATE INDEX IF NOT EXISTS idx_anti_patterns_analysis
  ON anti_patterns(analysis_id);

CREATE INDEX IF NOT EXISTS idx_anti_patterns_severity
  ON anti_patterns(severity);

-- ────────────────────────────────────────────────────────────
-- Dependencies — edge list per analysis
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dependencies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id     INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  source_file     TEXT NOT NULL,
  target_file     TEXT NOT NULL,
  dep_type        TEXT NOT NULL CHECK(dep_type IN ('import','export','inheritance','composition')),
  weight          REAL DEFAULT 1.0
);

CREATE INDEX IF NOT EXISTS idx_dependencies_analysis
  ON dependencies(analysis_id);

-- ────────────────────────────────────────────────────────────
-- Architecture Decision Records (ADRs)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'proposed'
                    CHECK(status IN ('proposed','accepted','deprecated','superseded')),
  context         TEXT,
  decision        TEXT,
  consequences    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────
-- Constraints — user-defined architecture rules tracked over time
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS constraints (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  rule_type       TEXT NOT NULL,  -- 'quality_gate', 'boundary', 'banned_import'
  definition      TEXT NOT NULL,  -- JSON of the rule
  active          INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ────────────────────────────────────────────────────────────
-- Validation results — per analysis, per constraint
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS validations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id     INTEGER NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  success         INTEGER NOT NULL,   -- 0 or 1
  violations      TEXT                -- JSON array of RuleViolation
);

-- ────────────────────────────────────────────────────────────
-- Forecasts — decay prediction snapshots
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS forecasts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  generated_at    TEXT NOT NULL,
  overall_outlook TEXT CHECK(overall_outlook IN ('sunny','cloudy','stormy')),
  headline        TEXT,
  modules         TEXT,               -- JSON array of ModuleForecast
  decay_current   REAL,
  decay_predicted REAL,
  decay_delta     REAL,
  confidence      REAL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_forecasts_project_time
  ON forecasts(project_id, generated_at DESC);
`;
