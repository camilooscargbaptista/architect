# @girardelli/architect-core API Reference

**Version:** v9.0+ (Fase 3.5)  
**License:** MIT  
**Author:** Camilo Girardelli — Girardelli Tecnologia

Complete technical reference for the architect-core package. For tutorials and guides, see the main documentation.

---

## Table of Contents

1. [Overview](#overview)
2. [Types & Interfaces](#types--interfaces)
3. [Core Classes](#core-classes)
4. [Scoring System](#scoring-system)
5. [Plugin System](#plugin-system)
6. [Knowledge Base](#knowledge-base)
7. [Configuration](#configuration)
8. [Analyzers](#analyzers)

---

## Overview

The `@girardelli/architect-core` package provides architectural analysis, scoring, anti-pattern detection, and refactoring guidance for codebases.

### Main Entry Points

```typescript
// Initialize analyzer
import { ArchitectureAnalyzer } from '@girardelli/architect-core/analyzer';
import { FileScanner } from '@girardelli/architect-core/scanner';
import { ArchitectureScorer } from '@girardelli/architect-core/scorer';
import { AntiPatternDetector } from '@girardelli/architect-core/anti-patterns';
import { RefactorEngine } from '@girardelli/architect-core/refactor-engine';
import { KnowledgeBase } from '@girardelli/architect-core/knowledge-base';
import { ConfigLoader } from '@girardelli/architect-core/config';
```

### Typical Workflow

```typescript
const config = ConfigLoader.loadConfig(projectPath);
const analyzer = new ArchitectureAnalyzer(projectPath);
const fileTree = new FileScanner(projectPath, config).scan();
const dependencies = analyzer.analyzeDependencies(fileTree);
const antiPatterns = await new AntiPatternDetector(config).detect(fileTree, dependencies);
const score = new ArchitectureScorer().score(edges, antiPatterns, fileCount);
const plan = new RefactorEngine().analyze(report, projectPath);
```

---

## Types & Interfaces

### Core Data Structures

#### DependencyEdge

Represents a single dependency between files.

```typescript
interface DependencyEdge {
  from: string;           // Source file path
  to: string;             // Target file path
  type: 'import' | 'export' | 'inheritance' | 'composition';
  weight: number;         // Edge weight (typically 1)
}
```

#### DependencyIndex

Pre-computed index for O(1) per-file edge lookups. Built once per analysis.

```typescript
interface DependencyIndex {
  incomingByFile: Map<string, DependencyEdge[]>;  // Files that import this file
  outgoingByFile: Map<string, DependencyEdge[]>;  // Files this file imports
  fanIn: Map<string, number>;                      // Incoming edge count per file
  fanOut: Map<string, number>;                     // Outgoing edge count per file
}

function buildDependencyIndex(edges: DependencyEdge[]): DependencyIndex;
```

#### ArchitectureScore

Hierarchical scoring structure with components and breakdowns.

```typescript
interface ScoreComponent {
  name: string;              // 'Modularity', 'Coupling', 'Cohesion', 'Layering'
  score: number;             // 0-100
  maxScore: number;          // Always 100
  weight: number;            // Profile-specific weight
  explanation: string;       // Human-readable description
}

interface ArchitectureScore {
  overall: number;           // Weighted average (0-100)
  components: ScoreComponent[];
  breakdown: {
    modularity: number;      // 0-100
    coupling: number;        // 0-100
    cohesion: number;        // 0-100
    layering: number;        // 0-100
  };
}
```

#### AntiPattern

Detected code smell or architectural issue.

```typescript
interface AntiPattern {
  name: string;                           // e.g., 'God Class', 'Circular Dependency'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;                       // File path or description
  description: string;                    // What the issue is
  suggestion: string;                     // How to fix it
  affectedFiles?: string[];               // Related files
  metrics?: Record<string, number | string>;  // Supporting data
}
```

#### Layer

Architectural layer classification.

```typescript
interface Layer {
  name: 'API' | 'Service' | 'Data' | 'UI' | 'Infrastructure';
  files: string[];                        // Files in this layer
  description: string;                    // Layer purpose
}
```

#### AnalysisReport

Complete output from analysis pipeline.

```typescript
interface AnalysisReport {
  timestamp: string;                      // ISO 8601 timestamp
  projectInfo: ProjectInfo;
  score: ArchitectureScore;
  antiPatterns: AntiPattern[];
  layers: Layer[];
  dependencyGraph: {
    nodes: string[];                      // All files
    edges: DependencyEdge[];
  };
  suggestions: Array<{
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    impact: string;
  }>;
  diagram: {
    mermaid: string;                      // Mermaid diagram syntax
    type: 'component' | 'layer' | 'dependency';
  };
  projectSummary?: ProjectSummary;        // Optional AI-generated summary
}
```

### Infrastructure Types

#### ProjectInfo

Project metadata and structure.

```typescript
interface ProjectInfo {
  path: string;
  name: string;
  frameworks: string[];                   // Detected frameworks (React, Django, etc.)
  totalFiles: number;
  totalLines: number;
  primaryLanguages: string[];             // TypeScript, Python, Java, etc.
  fileTree?: FileNode;
  workspaces?: WorkspaceInfo[];           // Monorepo workspace info
}

interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  extension?: string;
  lines?: number;
  language?: string;
  children?: FileNode[];
  imports?: string[];
  exports?: string[];
}
```

### Rules & Validation

#### ArchitectRules

Configuration file schema for `.architect.json` or `.architect-rules.json`.

```typescript
interface ArchitectRules {
  version: string;                        // SemVer
  project?: {
    name: string;
    description?: string;
  };
  quality_gates?: {
    min_overall_score?: number;           // Fail if below (0-100)
    max_critical_anti_patterns?: number;
    max_high_anti_patterns?: number;
  };
  boundaries?: {
    allow_circular_dependencies?: boolean;
    banned_imports?: string[];            // Paths to forbid importing
  };
}

interface RuleViolation {
  level: 'error' | 'warning';
  rule: string;                           // e.g., 'quality_gates.min_overall_score'
  message: string;
  actual?: number | string | string[];
  expected?: number | string | string[];
}

interface ValidationResult {
  success: boolean;                       // All errors passed
  violations: RuleViolation[];
}
```

### Refactoring Types

#### RefactorStep

Single refactoring action in a plan.

```typescript
interface RefactorStep {
  id: number;
  tier: 1 | 2;                            // Tier 1: rule-based, Tier 2: AST-based
  rule: string;                           // Which rule produced this
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  rationale: string;                      // Why this refactoring is needed
  operations: FileOperation[];
  scoreImpact: Array<{
    metric: string;                       // 'modularity', 'coupling', etc.
    before: number;
    after: number;
  }>;
  codePreview?: string;                   // Snippet showing the change
  aiPrompt?: string;                      // LLM prompt for code generation
}

interface FileOperation {
  type: 'CREATE' | 'MOVE' | 'MODIFY' | 'DELETE';
  path: string;
  newPath?: string;                       // For MOVE operations
  content?: string;                       // For CREATE/MODIFY
  diff?: string;                          // Unified diff format
  description: string;
}

interface RefactoringPlan {
  timestamp: string;
  projectPath: string;
  currentScore: ArchitectureScore;
  estimatedScoreAfter: {
    overall: number;
    breakdown: Record<string, number>;
  };
  steps: RefactorStep[];
  totalOperations: number;
  tier1Steps: number;
  tier2Steps: number;
  validation?: PlanValidation;            // Structural consistency check
}
```

---

## Core Classes

### ArchitectureAnalyzer

Parses source files and builds the dependency graph.

```typescript
class ArchitectureAnalyzer {
  constructor(projectPath: string);

  async initialize(): Promise<void>;
  
  /**
   * Extract all dependencies from the file tree.
   * Returns DependencyEdge[] representing imports/exports.
   */
  analyzeDependencies(fileTree: FileNode): DependencyEdge[];

  /**
   * Classify files into architectural layers (API, Service, Data, UI, Infrastructure).
   * Uses path patterns and naming conventions.
   */
  detectLayers(fileTree: FileNode): Layer[];

  /**
   * Identify module boundaries from directory structure.
   * Returns map of module name → file paths.
   */
  getModuleBoundaries(fileTree: FileNode): Map<string, string[]>;
}
```

#### Key Methods

**analyzeDependencies(fileTree)**
- Walks the entire file tree
- Parses imports/exports using AST or regex fallback
- Filters stdlib, vendor, and npm packages
- Returns deduplicated edges

**detectLayers(fileTree)**
- Categorizes files by layer based on path patterns
- Recognizes common directory names: `/controllers/`, `/services/`, `/entities/`, `/middleware/`, etc.
- Skips test files (`.test.ts`, `__tests__/`, etc.)

### ArchitectureScorer

Pure-function scoring engine using adaptive profiles.

```typescript
class ArchitectureScorer {
  /**
   * @param weights - Scoring weights (sum to 1.0)
   * @param thresholds - Metric-specific thresholds
   * @param profileName - Active profile name (for reporting)
   */
  constructor(
    weights?: ScoringWeights,
    thresholds?: ScoringThresholds,
    profileName?: string
  );

  /**
   * Compute complete architecture score from edges, anti-patterns, and file count.
   * Returns ArchitectureScore with breakdown and components.
   */
  score(
    edges: DependencyEdge[],
    antiPatterns: AntiPattern[],
    totalFiles: number
  ): ArchitectureScore;

  /**
   * Calculate modularity (0-100).
   * Based on average edges per file.
   */
  calculateModularity(edges: DependencyEdge[], totalFiles: number): number;

  /**
   * Calculate coupling (0-100).
   * Based on max fan-in/fan-out ratio.
   */
  calculateCoupling(edges: DependencyEdge[], totalFiles: number): number;

  /**
   * Calculate cohesion (0-100).
   * Based on ratio of internal vs. cross-module dependencies.
   */
  calculateCohesion(edges: DependencyEdge[]): number;

  /**
   * Calculate layering (0-100).
   * Based on layer-violation anti-patterns.
   */
  static calculateLayering(antiPatterns: AntiPattern[], totalFiles?: number): number;

  /**
   * Get the active profile name.
   */
  getProfileName(): string;
}
```

#### Scoring Defaults

```typescript
// Default weights
modularity: 0.40    // Module boundaries and SRP
coupling: 0.25      // Inter-module dependencies
cohesion: 0.20      // Functionality co-location
layering: 0.15      // Layer adherence

// Default thresholds
modularityExcellent: 2      // avg edges/file
modularityGood: 6
couplingExcellent: 0.15     // max edge ratio
couplingGood: 0.35
cohesionExcellent: 0.8      // internal edge ratio
cohesionGood: 0.45
godClassLines: 500          // lines threshold
godClassMethods: 10         // method count threshold
```

### AntiPatternDetector

Detects code smells and architectural issues.

```typescript
class AntiPatternDetector {
  constructor(config: ArchitectConfig);

  /**
   * Detect all anti-patterns in the codebase.
   */
  async detect(
    fileTree: FileNode,
    dependencies: Map<string, Set<string>>
  ): Promise<AntiPattern[]>;

  /**
   * Register custom anti-pattern detectors from plugins.
   */
  public setCustomDetectors(detectors: CustomAntiPatternDetector[]): void;

  /**
   * Set plugin context (for access to project path and config).
   */
  public setPluginContext(context: PluginContext): void;
}
```

#### Built-in Detections

| Name | Severity | Threshold |
|------|----------|-----------|
| **God Class** | CRITICAL | Lines > 800, Methods > 20 |
| **Circular Dependency** | HIGH | 2+ files in cycle |
| **Leaky Abstraction** | MEDIUM | > 5 internal exports |
| **Feature Envy** | MEDIUM | External calls > 3× internal |
| **Shotgun Surgery** | HIGH | File changes > 15 dependents |

### RefactorEngine

Orchestrates refactoring rules and generates action plans.

```typescript
class RefactorEngine {
  constructor();

  /**
   * Analyze project and generate refactoring plan.
   * Tier 1 rules run first, then plugin-provided rules.
   */
  analyze(report: AnalysisReport, projectPath: string): RefactoringPlan;

  /**
   * Register custom refactoring rules from plugins.
   */
  registerPluginRules(rules: RefactorRule[]): void;

  /**
   * Compute affected files after applying a step.
   * Used for incremental re-analysis.
   */
  computeAffectedScope(step: RefactorStep, index: DependencyIndex): AffectedScope;

  /**
   * Get total rule count (built-in + plugin).
   */
  getRuleCount(): number;
}

interface AffectedScope {
  changedFiles: string[];     // Created, modified, moved, or deleted
  consumerFiles: string[];    // Files that import any changed file
}
```

#### Built-in Tier 1 Rules

- **HubSplitterRule**: Identifies hub files (high fan-in) for splitting
- **BarrelOptimizerRule**: Simplifies re-export chains (index.ts)
- **ImportOrganizerRule**: Groups and sorts imports
- **ModuleGrouperRule**: Suggests module reorganization
- **DeadCodeDetectorRule**: Finds unused exports and imports

### RulesEngine

Validates architecture against governance rules.

```typescript
class RulesEngine {
  /**
   * Validate analysis report against rules.
   * Checks quality gates and boundaries.
   */
  public validate(report: AnalysisReport, rules: ArchitectRules): ValidationResult;
}
```

#### Validation Logic

```
1. Quality Gates:
   - min_overall_score: Fails if score < threshold
   - max_critical_anti_patterns: Error if exceeded
   - max_high_anti_patterns: Warning if exceeded

2. Boundaries:
   - allow_circular_dependencies: Error if false and cycles found
   - banned_imports: Error if files import forbidden paths
```

---

## Scoring System

### Scoring Profiles

Adaptive scoring for different project types. Profiles adjust weights and thresholds.

#### Available Profiles

```typescript
// Balanced (default)
'default' {
  weights: { modularity: 0.40, coupling: 0.25, cohesion: 0.20, layering: 0.15 }
  thresholds: { modularityExcellent: 2, couplingExcellent: 0.15, ... }
}

// React, Vue, Angular, Next.js
'frontend-spa' {
  weights: { modularity: 0.35, coupling: 0.15, cohesion: 0.35, layering: 0.15 }
  // Higher tolerance for coupling (component trees)
  // Emphasis on cohesion (co-located logic/styles/tests)
}

// Express, NestJS, Django, Rails, Spring Boot
'backend-monolith' {
  weights: { modularity: 0.35, coupling: 0.30, cohesion: 0.15, layering: 0.20 }
  // Strict coupling control, strict modularity
  // Emphasis on layering (MVC, clean arch)
}

// Go microservices, single-purpose services
'microservices' {
  weights: { modularity: 0.30, coupling: 0.20, cohesion: 0.25, layering: 0.25 }
  // Services already separated; file-level coupling less important
  // Layering and cohesion within each service key
}

// Python ML, ETL, data science
'data-pipeline' {
  weights: { modularity: 0.30, coupling: 0.25, cohesion: 0.35, layering: 0.10 }
  // Linear flows (extract → transform → load)
  // Cohesion of pipeline stages is priority
}

// Reusable packages and SDKs
'library' {
  weights: { modularity: 0.45, coupling: 0.20, cohesion: 0.25, layering: 0.10 }
  // Clean public APIs and module boundaries
  // Layering less relevant
}
```

### Profile Resolution

```typescript
function resolveProfile(options: {
  explicitProfile?: string;     // User-specified in config
  frameworks?: string[];        // Detected frameworks
  languages?: string[];         // Primary languages
  isMonorepo?: boolean;
}): ScoringProfile;
```

Priority:
1. Explicit user profile from `.architect.json`
2. Framework detection (React → frontend-spa, etc.)
3. Language heuristics (Python + no framework → data-pipeline)
4. Monorepo + Go → microservices
5. Fallback: 'default'

### Weight Merging

```typescript
function mergeWeights(
  profile: ScoringProfile,
  userWeights?: Partial<ScoringWeights>
): ScoringWeights;
```

User weights in `.architect.json` always override profile defaults. Result is normalized to sum to 1.0.

---

## Plugin System

### Writing Plugins

#### Plugin Manifest (architect-plugin.json)

```typescript
interface PluginManifest {
  name: string;                    // Unique identifier
  version: string;                 // SemVer
  description: string;
  author?: string;
  license?: string;
  architectVersion?: string;       // SemVer range, e.g., ">=9.0.0"
  keywords?: string[];             // For marketplace search
  main?: string;                   // Entry point (default: index.js)
  hooks: {
    antiPatterns?: boolean;        // Implement detectAntiPatterns
    refactorRules?: boolean;        // Implement refactorRules
    scoreModifiers?: boolean;       // Implement modifyScore
  };
}
```

#### Plugin Interface

```typescript
interface ArchitectPlugin {
  name: string;
  version: string;

  // Anti-Pattern Detection Hook
  detectAntiPatterns?: (
    fileTree: FileNode,
    dependencies: Map<string, Set<string>>,
    context: PluginContext
  ) => AntiPattern[] | Promise<AntiPattern[]>;

  // Refactor Rules Hook
  refactorRules?: RefactorRule[];

  // Score Modifier Hook
  modifyScore?: (
    breakdown: Record<string, number>,
    context: PluginContext
  ) => Record<string, number> | Promise<Record<string, number>>;

  // Lifecycle Hooks
  activate?: (context: PluginContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

interface PluginContext {
  projectPath: string;
  config: ArchitectConfig;
}
```

#### Example: Custom Anti-Pattern Detector

```typescript
// my-plugin/index.js
export default {
  name: 'my-custom-rules',
  version: '1.0.0',

  async detectAntiPatterns(fileTree, dependencies, context) {
    const patterns = [];
    
    // Custom detection logic
    for (const [file, deps] of dependencies) {
      if (deps.size > 20) {
        patterns.push({
          name: 'Too Many Dependencies',
          severity: 'HIGH',
          location: file,
          description: `File has ${deps.size} dependencies`,
          suggestion: 'Break into smaller modules'
        });
      }
    }
    
    return patterns;
  },

  async activate(context) {
    console.log(`Plugin activated in ${context.projectPath}`);
  }
};
```

#### Example: Custom Refactor Rule

```typescript
class CustomRule implements RefactorRule {
  name = 'custom-splitter';
  tier = 1;

  analyze(report, projectPath, index) {
    const steps = [];
    
    // Custom rule logic
    for (const ap of report.antiPatterns) {
      if (ap.name === 'Too Many Dependencies') {
        steps.push({
          id: 0,
          tier: 1,
          rule: this.name,
          priority: 'MEDIUM',
          title: 'Split file',
          description: `Split ${ap.location}`,
          rationale: 'Reduce complexity',
          operations: [
            {
              type: 'CREATE',
              path: ap.location.replace('.ts', '-1.ts'),
              description: 'Extract first half'
            }
          ],
          scoreImpact: [
            { metric: 'modularity', before: 60, after: 75 }
          ]
        });
      }
    }
    
    return steps;
  }
}
```

### Plugin Registry

```typescript
class PluginRegistry {
  constructor(projectPath: string);

  // Discovery & Installation
  discover(): PluginEntry[];              // Auto-discover from .architect/plugins
  installLocal(path: string): PluginEntry;
  installNpm(packageName: string, version?: string): PluginEntry;
  uninstall(name: string): boolean;

  // Management
  load(): void;                           // Load registry from disk
  save(): void;                           // Persist registry
  list(): PluginEntry[];
  get(name: string): PluginEntry | undefined;
  has(name: string): boolean;
  setEnabled(name: string, enabled: boolean): boolean;

  // Loading & Activation
  async loadAll(config: ArchitectConfig): Promise<ArchitectPlugin[]>;
  getRefactorRules(): RefactorRule[];
  getAntiPatternDetectors(): CustomAntiPatternDetector[];

  // Search
  searchNpm(query: string): PluginSearchResult[];
}

interface PluginEntry {
  name: string;
  version: string;
  source: 'local' | 'npm' | 'git';
  resolvedPath: string;
  enabled: boolean;
  manifest?: PluginManifest;
}
```

---

## Knowledge Base

### KnowledgeBase

SQLite-backed storage for analysis history, trends, and decisions.

```typescript
class KnowledgeBase {
  constructor(projectRoot: string, dbPath?: string);

  // Project Operations
  upsertProject(report: AnalysisReport): number;           // Returns project ID
  getProject(projectId: number): ProjectRecord | null;
  getProjectByPath(path: string): ProjectRecord | null;
  listProjects(): ProjectRecord[];

  // Analysis Persistence
  persistAnalysis(report: AnalysisReport): number;         // Returns analysis ID
  getLatestAnalysis(projectId: number): AnalysisRecord | null;
  listAnalyses(projectId: number, limit?: number): AnalysisRecord[];
  getFullReport(analysisId: number): AnalysisReport | null;

  // Score History & Trends
  getScoreHistory(projectId: number, limit?: number): ScorePoint[];
  getScoreDelta(projectId: number): { current, previous, delta } | null;
  getAntiPatternTrends(projectId: number): AntiPatternTrend[];

  // Dependency Analysis
  getTopHubs(analysisId: number, limit?: number): { file, fanIn }[];
  getFileDependencies(analysisId: number, filePath: string): {
    imports: DependencyEdge[];
    importedBy: DependencyEdge[];
  };

  // Architecture Decision Records
  addDecision(projectId: number, decision: {
    title: string;
    status?: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
    context?: string;
    decision?: string;
    consequences?: string;
  }): number;
  listDecisions(projectId: number): DecisionRecord[];
  updateDecisionStatus(decisionId: number, status: string): void;

  // Validation & Forecasts
  persistValidation(analysisId: number, result: ValidationResult): number;
  persistForecast(projectId: number, forecast: WeatherForecast, decay?: ...): number;

  // Analytics
  getStats(): KBStats;
  exportProjectHistory(projectId: number): {
    project, analyses, scoreHistory, antiPatternTrends, decisions
  };
  generateLLMContext(projectId: number): string;

  // Lifecycle
  close(): void;
  getDatabasePath(): string;
}
```

#### Data Types

```typescript
interface ProjectRecord {
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

interface AnalysisRecord {
  id: number;
  projectId: number;
  timestamp: string;
  score: { overall, modularity, coupling, cohesion, layering };
  totalNodes: number;
  totalEdges: number;
  antiPatternCount: number;
  createdAt: string;
}

interface ScorePoint {
  timestamp: string;
  overall: number;
  modularity: number;
  coupling: number;
  cohesion: number;
  layering: number;
}

interface AntiPatternTrend {
  name: string;
  severity: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
}

interface KBStats {
  totalProjects: number;
  totalAnalyses: number;
  totalAntiPatterns: number;
  totalDecisions: number;
  totalForecasts: number;
  dbSizeBytes: number;
}
```

### Usage Example

```typescript
import { KnowledgeBase } from '@girardelli/architect-core/knowledge-base';

const kb = new KnowledgeBase('/path/to/project');

// Persist analysis
const projectId = kb.upsertProject(report);
const analysisId = kb.persistAnalysis(report);

// Track trends
const history = kb.getScoreHistory(projectId);
const trends = kb.getAntiPatternTrends(projectId);

// Generate LLM context
const context = kb.generateLLMContext(projectId);
console.log(context);  // Human-readable project summary

kb.close();
```

---

## Configuration

### ConfigLoader

Loads and merges configuration from `.architect.json` and defaults.

```typescript
class ConfigLoader {
  static loadConfig(projectPath: string): ArchitectConfig;

  private static mergeConfigs(
    defaults: ArchitectConfig,
    user: ArchitectConfig
  ): ArchitectConfig;
}

function normalizeIgnorePatterns(patterns: string[]): string[];
```

### ArchitectConfig

Complete configuration schema.

```typescript
interface ArchitectConfig {
  // Ignore patterns (glob format)
  ignore?: string[];

  // Framework detection
  frameworks?: {
    detect?: boolean;                    // Auto-detect from package.json
  };

  // Anti-pattern thresholds
  antiPatterns?: {
    godClass?: {
      linesThreshold?: number;           // Default: 500
      methodsThreshold?: number;         // Default: 10
    };
    shotgunSurgery?: {
      changePropagationThreshold?: number;  // Default: 5
    };
  };

  // Score weights
  score?: {
    modularity?: number;                 // Default: 0.40
    coupling?: number;                   // Default: 0.25
    cohesion?: number;                   // Default: 0.20
    layering?: number;                   // Default: 0.15
  };

  // Scoring profile
  scoringProfile?: string;               // 'auto', 'frontend-spa', 'backend-monolith',
                                         // 'microservices', 'data-pipeline', 'library', 'default'

  // Monorepo support
  monorepo?: {
    enabled?: boolean;                   // Default: true
    treatPackagesAsModules?: boolean;    // Default: true
  };

  // Plugin paths
  plugins?: string[];

  // Genesis Engine (LLM prompt generation)
  genesis?: GenesisConfig;
}

interface GenesisConfig {
  maxTokensPerPrompt?: number;           // Default: 30000
  maxFullFileInlines?: number;           // Default: 5
  maxLinesPerFile?: number;              // Default: 300
  includeAbbreviatedContext?: boolean;   // Default: true
  targetModel?: 'gpt-4o' | 'claude-3' | 'gemini-pro' | 'qwen-32b' | 'custom';
  customTokenLimit?: number;
}
```

### Configuration File Example

```json
{
  "ignore": [
    "node_modules",
    "dist",
    ".next",
    "coverage"
  ],
  "frameworks": {
    "detect": true
  },
  "antiPatterns": {
    "godClass": {
      "linesThreshold": 800,
      "methodsThreshold": 20
    },
    "shotgunSurgery": {
      "changePropagationThreshold": 15
    }
  },
  "score": {
    "modularity": 0.40,
    "coupling": 0.25,
    "cohesion": 0.20,
    "layering": 0.15
  },
  "scoringProfile": "auto",
  "monorepo": {
    "enabled": true,
    "treatPackagesAsModules": true
  },
  "plugins": [
    "./plugins/custom-rules.js",
    "@my-org/architect-plugin"
  ],
  "genesis": {
    "targetModel": "claude-3",
    "maxTokensPerPrompt": 40000
  }
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG: ArchitectConfig = {
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.git/**',
    '**/.next/**',
    '**/venv/**',
    '**/__pycache__/**',
    '**/target/**',
    '**/out/**',
    '**/.cache/**',
  ],
  frameworks: { detect: true },
  antiPatterns: {
    godClass: { linesThreshold: 500, methodsThreshold: 10 },
    shotgunSurgery: { changePropagationThreshold: 5 },
  },
  score: {
    modularity: 0.4,
    coupling: 0.25,
    cohesion: 0.2,
    layering: 0.15,
  },
  scoringProfile: 'auto',
  monorepo: { enabled: true, treatPackagesAsModules: true },
  plugins: [],
};
```

---

## Analyzers

### TemporalScorer

Adds time-series awareness to architecture scoring using git history.

```typescript
class TemporalScorer {
  constructor(config?: TemporalScorerConfig);

  /**
   * Score modules temporally using git history + static scores.
   */
  score(
    gitReport: GitHistoryReport,
    staticScores: Map<string, number>
  ): TemporalReport;
}

interface TemporalScorerConfig {
  projectionWeeks?: number;              // Default: 12
  churnWeight?: number;                  // Default: 0.6
  commitWeight?: number;                 // Default: 0.4
  acceleratingThreshold?: number;        // Default: 15 (%)
  deceleratingThreshold?: number;        // Default: -15 (%)
}

type Trend = 'improving' | 'stable' | 'degrading';

interface TemporalScore {
  module: string;
  staticScore: number;                   // Current score (0-100)
  temporalScore: number;                 // Adjusted for trend
  trend: Trend;
  projectedScore: number;                // Score in N weeks
  projectionConfidence: number;          // 0-1
  projectionWeeks: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  velocity: VelocityVector;              // Churn, commit rates, etc.
}

interface TemporalReport {
  projectPath: string;
  analyzedAt: string;
  overallTrend: Trend;
  overallTemporalScore: number;
  modules: TemporalScore[];
  degradingModules: TemporalScore[];
  improvingModules: TemporalScore[];
}
```

### ForecastEngine

Predicts architectural issues using temporal data and velocity vectors.

```typescript
class ForecastEngine {
  constructor(config?: ForecastConfig);

  /**
   * Generate architecture weather forecast.
   */
  forecast(
    gitReport: GitHistoryReport,
    temporalReport: TemporalReport
  ): WeatherForecast;
}

interface ForecastConfig {
  antiPatternThreshold?: number;         // Default: 40
  godClassChurnThreshold?: number;       // Default: 150 (lines/commit)
  shotgunCouplingThreshold?: number;     // Default: 5
  busFactorRiskThreshold?: number;       // Default: 1
  forecastWeeks?: number;                // Default: 26 (6 months)
}

interface WeatherForecast {
  projectPath: string;
  generatedAt: string;
  overallOutlook: 'sunny' | 'cloudy' | 'stormy';
  headline: string;
  modules: ModuleForecast[];
  preAntiPatterns: PreAntiPattern[];     // Future issues
  topRisks: string[];                    // Key concerns
  recommendations: string[];             // Action items
}

interface ModuleForecast {
  module: string;
  currentHealth: 'healthy' | 'at-risk' | 'degrading' | 'critical';
  forecast6Months: 'stable' | 'declining' | 'breakdown';
  preAntiPatterns: PreAntiPattern[];
  bottleneckProbability: number;         // 0-1
  riskFactors: string[];
  topAction: string;
}

type PreAntiPatternType =
  | 'emerging-god-class'
  | 'emerging-shotgun-surgery'
  | 'emerging-feature-envy'
  | 'bus-factor-risk'
  | 'complexity-spiral'
  | 'coupling-magnet';

interface PreAntiPattern {
  type: PreAntiPatternType;
  module: string;
  severity: 'warning' | 'watch' | 'alert';
  currentScore: number;
  projectedScore: number;
  weeksToThreshold: number;              // ETA to anti-pattern
  threshold: number;
  description: string;
  evidence: string[];                    // Supporting data
  recommendation: string;
  confidence: number;                    // 0-1
}
```

### ProjectSummarizer

Infers project purpose and structure from metadata and code.

```typescript
class ProjectSummarizer {
  /**
   * Generate a human-readable summary of the project.
   */
  summarize(projectPath: string, report: AnalysisReport): ProjectSummary;
}

interface ProjectSummary {
  description: string;                   // What the project is
  purpose: string;                       // Why it exists
  modules: Array<{
    name: string;
    files: number;
    description: string;
  }>;
  techStack: string[];                   // Inferred tech stack
  entryPoints: string[];                 // Main files
  keywords: string[];                    // Search terms
}
```

---

## Common Patterns

### Full Analysis Workflow

```typescript
import {
  FileScanner,
  ArchitectureAnalyzer,
  AntiPatternDetector,
  ArchitectureScorer,
  RefactorEngine,
  RulesEngine,
  KnowledgeBase,
  ConfigLoader,
  resolveProfile,
  mergeWeights,
} from '@girardelli/architect-core';

async function analyzeProject(projectPath) {
  // 1. Load configuration
  const config = ConfigLoader.loadConfig(projectPath);

  // 2. Scan files
  const scanner = new FileScanner(projectPath, config);
  const fileTree = scanner.scan();

  // 3. Analyze dependencies
  const analyzer = new ArchitectureAnalyzer(projectPath);
  await analyzer.initialize();
  const edges = analyzer.analyzeDependencies(fileTree);
  const layers = analyzer.detectLayers(fileTree);

  // 4. Detect anti-patterns
  const detectorConfig = { ...config };
  const detector = new AntiPatternDetector(detectorConfig);
  const antiPatterns = await detector.detect(fileTree, buildDepsMap(edges));

  // 5. Score with adaptive profile
  const profile = resolveProfile({
    explicitProfile: config.scoringProfile,
    frameworks: fileTree.frameworks,
    languages: fileTree.languages,
    isMonorepo: config.monorepo?.enabled,
  });
  const mergedWeights = mergeWeights(profile, config.score);
  const scorer = new ArchitectureScorer(mergedWeights, profile.thresholds, profile.name);
  const score = scorer.score(edges, antiPatterns, fileTree.totalFiles);

  // 6. Generate refactoring plan
  const refactorer = new RefactorEngine();
  const plan = refactorer.analyze(analysisReport, projectPath);

  // 7. Validate against rules
  const rulesEngine = new RulesEngine();
  const validation = rulesEngine.validate(analysisReport, rules);

  // 8. Persist to knowledge base
  const kb = new KnowledgeBase(projectPath);
  kb.persistAnalysis(analysisReport);
  kb.persistValidation(analysisId, validation);
  kb.close();

  return analysisReport;
}
```

### Using Plugins

```typescript
import { PluginRegistry, PluginLoader } from '@girardelli/architect-core';

async function loadPlugins(projectPath, config) {
  // Option 1: Use PluginRegistry (recommended)
  const registry = new PluginRegistry(projectPath);
  registry.load();
  
  // Auto-discover plugins from .architect/plugins
  const discovered = registry.discover();
  discovered.forEach(entry => registry.entries.set(entry.name, entry));
  registry.save();

  // Load all enabled plugins
  const plugins = await registry.loadAll(config);
  const refactorRules = registry.getRefactorRules();
  const antiPatternDetectors = registry.getAntiPatternDetectors();

  // Option 2: Use PluginLoader (lightweight)
  const loader = new PluginLoader(projectPath, config);
  await loader.loadPlugins();
  const customDetectors = loader.customAntiPatternDetectors;

  return { plugins, refactorRules, antiPatternDetectors };
}
```

### Custom Scoring

```typescript
import { ScoringWeights, ScoringThresholds } from '@girardelli/architect-core';

// Override defaults completely
const customWeights: ScoringWeights = {
  modularity: 0.5,
  coupling: 0.3,
  cohesion: 0.1,
  layering: 0.1,
};

const customThresholds: ScoringThresholds = {
  modularityExcellent: 1,
  modularityGood: 3,
  couplingExcellent: 0.10,
  couplingGood: 0.30,
  cohesionExcellent: 0.85,
  cohesionGood: 0.50,
  godClassLines: 1000,
  godClassMethods: 25,
};

const scorer = new ArchitectureScorer(customWeights, customThresholds, 'custom');
const score = scorer.score(edges, antiPatterns, fileCount);
```

---

## Error Handling

### Common Exceptions

```typescript
// File not found
throw new Error(`Plugin path not found: ${resolvedPath}`);

// Invalid manifest
throw new Error(`Plugin '${name}' does not export a valid ArchitectPlugin object`);

// Module import failure
throw new Error(`Failed to load plugin '${name}': ${error.message}`);

// npm install failure
throw new Error(`npm install failed for '${spec}': ${error.message}`);

// Database errors (KnowledgeBase)
// Caught internally; calls log errors instead of throwing
```

---

## Performance Notes

### Optimization Strategies

1. **DependencyIndex**: Pre-built once per analysis (Fase 2.6)
   - O(1) per-file edge lookups instead of O(E) scans
   - Net effect: O(R×E) → O(E) for R rules

2. **AST vs Regex**: AST parsing preferred, regex fallback
   - AST initialization is lazy; fails gracefully
   - Regex fallback for missing grammars or edge cases

3. **Plugin Filtering**: External dependencies removed before rules run
   - Eliminates duplicated filtering logic
   - Protects future rules automatically

4. **Database**: SQLite with WAL journaling
   - Concurrent reads while writes in progress
   - Efficient schema with proper indices

### Scaling Guidelines

| Metric | Threshold | Recommendation |
|--------|-----------|-----------------|
| **Files** | 5K+ | Monitor analysis time; consider excluding large vendor dirs |
| **Edges** | 50K+ | Dependency index helps; thresholds may need tuning |
| **Rules** | 20+ | Rules run sequentially; parallelization future work |
| **DB** | 1GB+ | Archive old analyses; consolidate forecasts |

---

## Versioning & Compatibility

### Breaking Changes

- v9.0: Introduced adaptive scoring profiles, temporal analysis, forecast engine
- v8.2: Added DependencyIndex for O(1) lookups
- v8.0: Refactored as pure functions (ArchitectureScorer)

### SemVer

- **Major**: Breaking API changes, new required config, new types
- **Minor**: New features (profiles, rules, analyzers), backward compatible
- **Patch**: Bug fixes, performance improvements, non-breaking config additions

### Plugin Compatibility

Plugins declare `architectVersion` in manifest (SemVer range):

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "architectVersion": ">=9.0.0 <10.0.0"
}
```

---

## License

MIT — See LICENSE file in repository

---

**Last Updated:** 2026-04-08  
**Maintainer:** Camilo Girardelli — Girardelli Tecnologia
