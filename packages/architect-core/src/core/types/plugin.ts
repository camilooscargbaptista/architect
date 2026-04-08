import { AntiPattern, ArchitectConfig } from './core.js';
import { FileNode } from './infrastructure.js';
import { RefactorRule } from './rules.js';

// ═══════════════════════════════════════════════════════════════
// PLUGIN CONTEXT & HOOKS
// ═══════════════════════════════════════════════════════════════

export interface PluginContext {
  projectPath: string;
  config: ArchitectConfig;
}

export type CustomAntiPatternDetector = (
  fileTree: FileNode,
  dependencies: Map<string, Set<string>>,
  context: PluginContext
) => AntiPattern[] | Promise<AntiPattern[]>;

// ═══════════════════════════════════════════════════════════════
// PLUGIN MANIFEST (architect-plugin.json)
// ═══════════════════════════════════════════════════════════════

/** Schema for architect-plugin.json — the manifest file in every plugin package. */
export interface PluginManifest {
  /** Plugin identifier (should match npm package name) */
  name: string;
  /** SemVer version string */
  version: string;
  /** Human-readable description */
  description: string;
  /** Plugin author */
  author?: string;
  /** SPDX license identifier */
  license?: string;
  /** Minimum Architect version required (semver range) */
  architectVersion?: string;
  /** Keywords for marketplace search */
  keywords?: string[];
  /** Entry point relative to package root (default: index.js) */
  main?: string;
  /** Hooks this plugin provides */
  hooks: PluginHooksDeclaration;
}

/** Declares which hooks the plugin implements */
export interface PluginHooksDeclaration {
  /** Custom anti-pattern detectors */
  antiPatterns?: boolean;
  /** Custom refactoring rules */
  refactorRules?: boolean;
  /** Score modifiers (adjust scoring weights or add custom components) */
  scoreModifiers?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// ARCHITECT PLUGIN INTERFACE (runtime)
// ═══════════════════════════════════════════════════════════════

export interface ArchitectPlugin {
  /** Unique plugin name */
  name: string;
  /** SemVer version */
  version: string;

  // ── Hook: Anti-Pattern Detection ──
  /** Custom anti-pattern detector function */
  detectAntiPatterns?: CustomAntiPatternDetector;

  // ── Hook: Refactor Rules ──
  /** Custom refactoring rules that plug into RefactorEngine */
  refactorRules?: RefactorRule[];

  // ── Hook: Score Modifiers ──
  /** Adjust score weights or add custom score components */
  modifyScore?: ScoreModifierFn;

  // ── Lifecycle ──
  /** Called when the plugin is activated */
  activate?: (context: PluginContext) => void | Promise<void>;
  /** Called when the plugin is deactivated */
  deactivate?: () => void | Promise<void>;
}

/** Function that can adjust score breakdown values */
export type ScoreModifierFn = (
  breakdown: Record<string, number>,
  context: PluginContext,
) => Record<string, number> | Promise<Record<string, number>>;

// ═══════════════════════════════════════════════════════════════
// PLUGIN REGISTRY TYPES
// ═══════════════════════════════════════════════════════════════

/** Where a plugin was discovered */
export type PluginSource = 'local' | 'npm' | 'git';

/** A plugin entry in the registry */
export interface PluginEntry {
  /** Plugin name */
  name: string;
  /** Installed version */
  version: string;
  /** How it was installed */
  source: PluginSource;
  /** Resolved path on disk */
  resolvedPath: string;
  /** Whether the plugin is currently enabled */
  enabled: boolean;
  /** Parsed manifest (if available) */
  manifest?: PluginManifest;
}

/** Result of a plugin marketplace search */
export interface PluginSearchResult {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  author?: string;
  downloads?: number;
}
