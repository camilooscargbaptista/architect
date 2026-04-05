# Architect v9.0 — Session Handoff

**Data:** 2026-04-02
**Autor:** Claude (CTO assist para Camilo @ Girardelli Tecnologia)
**Estado:** Fase 3.6 completa — TODAS as fases do EVOLUTION_PLAN finalizadas 🚀

---

## LLM Strategy (CRITICAL — DO NOT CHANGE)

- **Inference:** vLLM on EC2 Spot
- **Fine-tuning:** Modal with A100
- **Data:** S3
- **Transitional fallback:** Claude API direct
- **NOT:** Together.ai, NOT Bedrock, NOT SageMaker

---

## Status por Fase

| Fase | Item | Status | Notas |
|------|------|--------|-------|
| 0 | Critical Fixes (0.1-0.6) | DONE | Todas as 6 correções aplicadas |
| 1 | Genesis Engine Hardening | DONE | Testes, robustez, configurabilidade |
| 2.1 | Centralized External Dep Filter | DONE | `isExternalDependency()` em RefactorEngine |
| 2.2 | Language Utils Extraction | DONE | `language-utils.ts` |
| 2.3 | Type Safety (eliminate `any`) | DONE | 48 `any` eliminados em 11 arquivos |
| 2.4 | Barrel Elimination | DONE | `architect_deps.ts` já removido anteriormente |
| 2.5 | Strict TypeScript Flags | DONE | 3 flags, ~150 erros corrigidos em ~30 arquivos |
| 2.6 | DependencyIndex | DONE | O(1) lookups, integrado em todas 5 rules |
| 3.5 | GenesisValidator | DONE | 6 validation passes, 25 tests |
| 3.1 | Multi-Pass Generator | DONE | 5 rule strategies, integrado no OfflinePromptGenerator |
| 3.3 | Interactive Refactoring Mode | DONE | `architect refactor . --interactive`, 15 tests |
| 3.2 | Forecast v2: ML-Based Prediction | DONE | Weighted regression, score timeline, 42 tests |
| 3.4 | Plugin Marketplace | DONE | PluginRegistry, manifest spec, CLI commands, 41 tests |
| 3.6 | VSCode Extension Enhancement | DONE | Diagnostics, Code Lens, Forecast overlay, Genesis context menu, Status Bar |

---

## Arquitetura do Monorepo

```
packages/
  architect-core/     # Engine: analyzer, scorer, rules, types, genesis-validator
  architect-agents/   # AI layer: agent-runtime, offline-prompt-generator, multi-pass
  architect/          # CLI adapter: cli.ts, reporters, html output
```

- ESM modules, TypeScript strict mode (com noUncheckedIndexedAccess, exactOptionalPropertyTypes, noPropertyAccessFromIndexSignature)
- Jest com ts-jest, Node16 module resolution
- Monorepo com workspaces

---

## Componentes-Chave Implementados

### DependencyIndex (2.6)
```typescript
// packages/architect-core/src/core/types/core.ts
export interface DependencyIndex {
  incomingByFile: Map<string, DependencyEdge[]>;
  outgoingByFile: Map<string, DependencyEdge[]>;
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
}
export function buildDependencyIndex(edges: DependencyEdge[]): DependencyIndex;
```
- Built once in RefactorEngine.analyze(), passed to all 5 rules
- Rules have backward-compat fallback: `if (index) { O(1) lookup } else { O(E) scan }`

### GenesisValidator (3.5)
```typescript
// packages/architect-core/src/core/genesis-validator.ts
export class GenesisValidator {
  validate(plan: RefactoringPlan, projectFiles?: Set<string>): ValidationResult;
}
```
- 6 passes: circular ops, orphan imports, incomplete splits, path collisions, scope violations, empty steps
- Auto-runs in RefactorEngine, result attached to `plan.validation`
- 25 tests in `packages/architect-core/tests/genesis-validator.test.ts`

### MultiPassGenerator (3.1)
```typescript
// packages/architect-agents/src/core/agent-runtime/multi-pass-generator.ts
export interface PromptPass {
  passNumber: number;
  objective: string;
  contextSource: 'source' | 'previous' | 'analysis';
  outputContract: string;
  dependsOn?: number;
  content: string;
}
export interface PromptChain {
  stepId: number;
  stepTitle: string;
  rule: string;
  passCount: number;
  passes: PromptPass[];
}
export class MultiPassGenerator {
  decompose(step: RefactorStep): PromptChain;
}
```

**Pass counts per rule:**
| Rule | Passes | Strategy |
|------|--------|----------|
| hub-splitter | 3 | analyze → split → update consumers |
| barrel-optimizer | 2 | analyze → replace imports |
| import-organizer | 2 | generate facade → rewire |
| module-grouper | 3 | analyze → move → fix imports |
| dead-code-detector | 1 | verify & remove |
| default/unknown | 1 | backward compat wrapper |

**Integrado no OfflinePromptGenerator:**
- Multi-pass steps → one file per pass: `01-step-1-pass-1.md`, `01-step-1-pass-2.md`
- Single-pass steps → backward compat: `01-step-1.md`
- Index shows multi-pass structure with dependency chains

### RefactorEngine Flow (current)
```
analyze(report, projectPath)
  → buildDependencyIndex(edges)
  → filter external deps
  → for each rule: rule.analyze(report, projectPath, index)
  → merge plans
  → GenesisValidator.validate(plan, projectFiles)
  → attach plan.validation
  → return plan

computeAffectedScope(step, index)         [Fase 3.3]
  → collect changedFiles from step.operations
  → O(1) lookup consumers via index.incomingByFile
  → return { changedFiles, consumerFiles }
```

### Interactive Refactoring Flow (Fase 3.3)
```
InteractiveRefactor.run()
  → architect.analyze() → initial report
  → architect.refactor() → plan
  → ensureGitSafety() → protective branch
  → for each step:
      → multiPass.decompose(step) → chain preview
      → promptStepAction() → execute | skip | quit
      → createRollbackPoint() → git safety
      → executeStep() → file operations
      → commitStep() → atomic git commit
      → architect.analyze() → re-scan
      → printScoreDelta() → score tracking
      → if |scoreDelta| >= 3: re-generate plan
  → printSessionSummary()
```

---

## 5 Tier-1 Refactoring Rules

1. **hub-splitter** — Splits files with high fan-in (>threshold connections)
2. **barrel-optimizer** — Eliminates barrel re-export files that create dependency chains
3. **import-organizer** — Creates facades for files with cross-boundary imports
4. **module-grouper** — Co-locates files that are always imported together
5. **dead-code-detector** — Identifies and removes files with zero incoming dependencies

All rules accept `index?: DependencyIndex` parameter for O(1) lookups.

---

## Test Status

**Last run:** 35 suites, 629 tests (41 new for 3.4), 15 snapshots — ALL GREEN
**Build:** 0 TypeScript errors

**Pre-existing failures (NOT our changes — excluded from validation):**
- `ast-parser.test.ts` — tree-sitter ELF binary issue in test env
- `github-action.test.ts` — missing @actions/core
- `agent-runtime.test.ts` — @inquirer/prompts ESM issue

---

### InteractiveRefactor (3.3)
```typescript
// packages/architect/src/core/interactive-refactor.ts
export class InteractiveRefactor {
  constructor(config: InteractiveConfig);
  run(): Promise<InteractiveSession>;
}
export interface InteractiveConfig {
  projectPath: string;
  autoMode?: boolean;
  providerType?: string;
  onProgress?: (event: InteractiveEvent) => void;
}
export interface InteractiveSession {
  originalScore: number;
  currentScore: number;
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  rolledBackSteps: number;
  results: StepResult[];
}
```

**Features:**
- Step-by-step TUI: preview → approve → execute → re-analyze → next
- Multi-pass awareness: shows pass decomposition for complex steps
- Git safety: protective branch + per-step rollback (git checkout --)
- Score tracking: before/after per step with colored delta display
- Auto mode: `--auto` flag for CI/headless usage
- Event system: onProgress callback for tooling integration
- Re-analysis: full re-scan after each step, re-generates plan on significant score change (±3)

**CLI usage:**
```bash
architect refactor ./src --interactive     # guided mode
architect refactor ./src --interactive --auto  # auto-approve all steps
```

### RefactorEngine.computeAffectedScope (3.3)
```typescript
// packages/architect-core/src/core/refactor-engine.ts
export interface AffectedScope {
  changedFiles: string[];   // directly modified/created/deleted/moved
  consumerFiles: string[];  // files that import any changed file
}
computeAffectedScope(step: RefactorStep, index: DependencyIndex): AffectedScope;
```
- O(1) consumer lookup via DependencyIndex
- Used for scoped re-analysis (avoids full project re-scan)
- 8 tests in `packages/architect-core/tests/refactor-engine-scope.test.ts`
- 7 tests in `packages/architect/tests/interactive-refactor.test.ts`

---

### Forecast V2: ML-Based Prediction (3.2)

**3 new modules in `packages/architect-core/src/core/analyzers/`:**

```typescript
// decay-regressor.ts — Weighted linear regression
export class DecayRegressor {
  forecast(data: ScoreDataPoint[]): DecayForecast | null;
  applyWeights(data: ScoreDataPoint[]): ScoreDataPoint[];
  fitWeightedRegression(data: ScoreDataPoint[]): RegressionResult;
  generateTrajectory(regression, startWeek, endWeek): ScorePrediction[];
}

// score-timeline.ts — Historical score reconstruction
export class ScoreTimelineBuilder {
  buildProjectTimeline(gitReport, currentScore, totalFiles): ProjectTimeline;
  extractFeatures(timeline: WeeklySnapshot[], totalFiles): WeeklyFeatures[];
  reconstructScoreTimeline(features, currentScore): ScoreDataPoint[];
}

// forecast-v2.ts — Full prediction engine
export class ForecastV2Engine {
  predict(analysisReport, gitReport, temporalReport?): ForecastV2Report;
}
```

**Pipeline:**
```
GitHistoryReport (weekly snapshots)
  → ScoreTimelineBuilder.extractFeatures()
  → ScoreTimelineBuilder.reconstructScoreTimeline()
  → DecayRegressor.forecast() [weighted least-squares]
  → ForecastV2Engine.predict() [enriched report]
```

**Key features:**
- Exponential recency weighting (half-life = 8 weeks)
- R² goodness-of-fit, t-stat significance testing
- 95% confidence intervals that widen with extrapolation distance
- Per-module decay predictions with risk drivers
- Threshold analysis: "critical threshold in ~N weeks"
- CLI: `architect forecast ./src` (pretty output or `--format json`)

**Tests:** 42 total across 3 test files
- `decay-regressor.test.ts` — 20 tests (regression, weights, trajectory, confidence)
- `score-timeline.test.ts` — 12 tests (features, reconstruction, timelines)
- `forecast-v2.test.ts` — 10 tests (integration, risk classification, enrichment)

### Plugin Marketplace (Fase 3.4)

**3 new/modified modules:**

```typescript
// packages/architect-core/src/core/types/plugin.ts — Extended
export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author?: string;
  license?: string;
  architectVersion?: string;
  keywords?: string[];
  main?: string;
  hooks: PluginHooksDeclaration;
}

export interface ArchitectPlugin {
  name: string;
  version: string;
  detectAntiPatterns?: CustomAntiPatternDetector;
  refactorRules?: RefactorRule[];          // NEW — plug custom rules
  modifyScore?: ScoreModifierFn;           // NEW — adjust score weights
  activate?: (context: PluginContext) => void | Promise<void>;   // NEW — lifecycle
  deactivate?: () => void | Promise<void>;                       // NEW — lifecycle
}

// packages/architect-core/src/core/plugin-registry.ts — NEW
export class PluginRegistry {
  load(): void;                            // Load from .architect/plugin-registry.json
  save(): void;                            // Persist registry
  list(): PluginEntry[];                   // All registered plugins
  installLocal(path: string): PluginEntry; // Install from local path
  installNpm(name: string): PluginEntry;   // Install from npm
  uninstall(name: string): boolean;        // Remove plugin
  setEnabled(name: string, enabled: boolean): boolean;
  loadAll(config): Promise<ArchitectPlugin[]>;  // Load & activate all enabled
  getRefactorRules(): RefactorRule[];      // Collect rules from all loaded plugins
  getAntiPatternDetectors(): CustomAntiPatternDetector[];
  searchNpm(query: string): PluginSearchResult[];
  discover(): PluginEntry[];               // Auto-discover from .architect/plugins/
}
```

**RefactorEngine integration:**
```typescript
// packages/architect-core/src/core/refactor-engine.ts — MODIFIED
export class RefactorEngine {
  registerPluginRules(rules: RefactorRule[]): void;  // NEW
  getRuleCount(): number;                             // NEW
  // analyze() now runs [...builtInRules, ...pluginRules]
}
```

**CLI commands:**
```bash
architect plugin install <package-or-path>   # Install from npm or local
architect plugin list                        # List installed plugins
architect plugin search <query>              # Search npm
architect plugin remove <name>               # Uninstall
architect plugin enable <name>               # Enable
architect plugin disable <name>              # Disable
```

**Tests:** 41 total across 3 test files
- `plugin-types.test.ts` — 10 tests (type contracts, manifest, lifecycle)
- `plugin-registry.test.ts` — 24 tests (persistence, install, discover, enable/disable, rules)
- `refactor-engine-plugins.test.ts` — 7 tests (engine integration, priority sorting, validation)

### VSCode Extension Enhancement (Fase 3.6)

**Rewrite completo de `packages/architect-vscode/`** — de 60 linhas para ~500 linhas.

**Features implementadas:**

1. **Score Diagnostics Provider** — Anti-patterns aparecem como diagnostics no editor (Error/Warning/Info severity), refactoring steps como Hints. Navegação por arquivo afetado.

2. **Code Lens Provider** — Arquivos hub (5+ dependents, configurável) mostram:
   - `$(circuit-board) Hub File — N dependents`
   - `$(split-horizontal) Split this hub` (abre interactive refactor)
   - `$(warning) Anti-Pattern Name (severity)` (se aplicável)

3. **Forecast Decoration Provider** — Overlay visual em arquivos at-risk:
   - Critical: background vermelho + `⚠ Critical Risk`
   - High: background laranja + `⚡ High Risk`
   - Medium: background amarelo + `◆ Medium Risk`
   - Hover com markdown mostrando score prediction + links de ação

4. **Genesis Context Menu** — Right-click em qualquer arquivo → "Generate Refactoring Prompt" → abre markdown com steps filtrados para aquele arquivo

5. **Status Bar** — Score live com ícone contextual (pass/warning/error), tooltip com breakdown completo

6. **8 Commands registrados:**
   - `architect.analyze` — Full analysis com diagnostics
   - `architect.refactor` — Interactive refactoring terminal
   - `architect.forecast` — ML-based decay prediction com decorations
   - `architect.genesis` — Genesis TUI terminal
   - `architect.genesisFile` — Genesis prompt para arquivo específico
   - `architect.pluginList` — List installed plugins
   - `architect.showAntiPatterns` — QuickPick com navegação
   - `architect.splitHub` — Split hub file (via Code Lens)

7. **3 Settings configuráveis:**
   - `architect.autoAnalyzeOnOpen` (bool, default: false)
   - `architect.analyzeOnSave` (bool, default: false)
   - `architect.hubThreshold` (number, default: 5, min: 2, max: 50)

8. **Activation Events:** onLanguage para ts/js/py/go/rs/java

**Build:** 0 TypeScript errors. Esbuild bundle para `dist/extension.js`.

---

## Padrões de Código Importantes

### exactOptionalPropertyTypes
```typescript
// NÃO PODE:
const obj: { name?: string } = { name: undefined }; // ERRO

// CORRETO:
const obj: { name?: string } = {};
// ou spread condicional:
...(value !== undefined ? { name: value } : {})
```

### noUncheckedIndexedAccess
```typescript
// Array/Map indexing retorna T | undefined
const arr = [1, 2, 3];
const val = arr[0]; // number | undefined — precisa de ! ou guard
const val2 = arr[0]!; // number — quando você tem certeza
```

### noPropertyAccessFromIndexSignature
```typescript
// Para index signatures, usar bracket notation:
process.env['NODE_ENV'] // OK
process.env.NODE_ENV    // ERRO
```

---

## Comandos Úteis

```bash
# Build
npx tsc -b --pretty

# Todos os testes
npx jest --no-coverage

# Teste específico
npx jest packages/architect-core/tests/genesis-validator.test.ts --no-coverage

# Update snapshots
npx jest packages/architect-agents/tests/genesis-snapshot.test.ts -u --no-coverage
```
