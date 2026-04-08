# Architect v8 — Plano de Evolução Completo

**Versão:** 1.0
**Data:** 2026-03-31
**Autor:** Análise técnica independente
**Target:** @girardelli/architect v8.1.0 → v9.0
**Meta:** Excelência e unicidade no mercado de analysis tooling

---

## Visão Geral

Este plano cobre 4 fases de evolução, do bug fix imediato até a transformação estratégica. Cada fase é auto-contida — pode ser entregue e validada independentemente.

| Fase | Nome | Escopo | Estimativa |
|------|------|--------|------------|
| 0 | Critical Fixes | 6 correções de bugs identificados | 2-3 dias |
| 1 | Genesis Engine Hardening | Testes, robustez, configurabilidade | 1 semana |
| 2 | Architectural Refinement | Dívida técnica, type safety, performance | 2 semanas |
| 3 | Strategic Evolution | Funcionalidades diferenciadoras | 4-6 semanas |

---

## Fase 0 — Critical Fixes (P0)

> **Objetivo:** Corrigir os 6 bugs que invalidam a saída do Genesis Engine.
> **Critério de aceite:** Genesis gera prompts corretos contra o próprio monorepo do Architect.

### Fix 0.1 — Standard Library Filter (hub-splitter.ts)

**Problema:** `isDotNotation` em `hub-splitter.ts:46` classifica imports bare (`fs`, `path`, `crypto`) como módulos internos dot-notation, inflando o grafo de dependências. Resultado: Genesis tenta "splittar" módulos do Node.js.

**Arquivo:** `packages/architect-core/src/core/rules/hub-splitter.ts`

**Solução:** Criar um `StandardLibraryRegistry` que filtra dependências externas **para todas as 6 linguagens** que o Tree-sitter já parseia. Não basta cobrir Node — se o Architect analisa Go, `fmt` e `os` causam o mesmo problema.

```typescript
// packages/architect-core/src/core/utils/stdlib-registry.ts (NOVO)

const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
  'console', 'constants', 'crypto', 'dgram', 'diagnostics_channel',
  'dns', 'domain', 'events', 'fs', 'http', 'http2', 'https',
  'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl',
  'stream', 'string_decoder', 'sys', 'timers', 'tls', 'trace_events',
  'tty', 'url', 'util', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib',
  // Subpaths comuns
  'fs/promises', 'stream/promises', 'stream/web', 'timers/promises',
  'util/types', 'dns/promises', 'readline/promises',
]);

const PYTHON_STDLIB = new Set([
  'os', 'sys', 'io', 'json', 'csv', 'math', 'random', 'datetime',
  'collections', 'itertools', 'functools', 'typing', 'pathlib',
  'subprocess', 'threading', 'multiprocessing', 'socket', 'http',
  'urllib', 'email', 'logging', 'argparse', 'unittest', 'abc',
  'dataclasses', 'enum', 're', 'hashlib', 'hmac', 'secrets',
  'asyncio', 'concurrent', 'contextlib', 'copy', 'pprint',
  'textwrap', 'struct', 'codecs', 'glob', 'shutil', 'tempfile',
  'sqlite3', 'xml', 'html', 'importlib', 'inspect', 'traceback',
]);

const RUST_STDLIB = new Set([
  'std', 'core', 'alloc', 'proc_macro',
]);

const JAVA_STDLIB_PREFIXES = ['java.', 'javax.', 'sun.', 'com.sun.'];

export type SupportedLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java';

/**
 * Determines whether a given import path refers to a standard library
 * or external/vendor module (not part of the project source).
 */
export function isExternalDependency(
  importPath: string,
  language: SupportedLanguage,
  projectFiles: Set<string>,
): boolean {
  // Universal: relative paths are ALWAYS internal
  if (importPath.startsWith('./') || importPath.startsWith('../') || importPath.startsWith('/')) {
    return false;
  }

  // Language-specific stdlib checks
  switch (language) {
    case 'typescript':
    case 'javascript': {
      // node: prefix (e.g., node:fs)
      if (importPath.startsWith('node:')) return true;
      // Known builtins
      const baseModule = importPath.split('/')[0];
      if (NODE_BUILTINS.has(importPath) || NODE_BUILTINS.has(baseModule)) return true;
      // Scoped packages (@org/pkg) or bare npm packages
      // If it's not in projectFiles, it's external
      break;
    }
    case 'python': {
      const topModule = importPath.split('.')[0];
      if (PYTHON_STDLIB.has(topModule)) return true;
      break;
    }
    case 'go': {
      // Go stdlib has no dots in import path
      if (!importPath.includes('.')) return true;
      break;
    }
    case 'rust': {
      const rootCrate = importPath.split('::')[0];
      if (RUST_STDLIB.has(rootCrate)) return true;
      break;
    }
    case 'java': {
      if (JAVA_STDLIB_PREFIXES.some(p => importPath.startsWith(p))) return true;
      break;
    }
  }

  // Fallback: if path doesn't resolve to any project file, it's external
  // This catches npm packages, pip packages, Go modules, Maven deps, etc.
  if (!projectFiles.has(importPath)) {
    // Extra heuristic: bare specifiers without extensions are likely vendor
    const hasNoExtension = !importPath.includes('.');
    const isNotRelative = !importPath.startsWith('.');
    if (hasNoExtension && isNotRelative) return true;
  }

  return false;
}

export function detectLanguage(projectInfo: { language?: string }): SupportedLanguage {
  const lang = (projectInfo.language || '').toLowerCase();
  const MAP: Record<string, SupportedLanguage> = {
    typescript: 'typescript', ts: 'typescript',
    javascript: 'javascript', js: 'javascript',
    python: 'python', py: 'python',
    go: 'go', golang: 'go',
    rust: 'rust', rs: 'rust',
    java: 'java',
  };
  return MAP[lang] ?? 'typescript';
}
```

**Aplicação no hub-splitter.ts:**

```typescript
// ANTES (bugado):
const isDotNotation = !file.includes('/') && !file.includes('\\');

// DEPOIS:
import { isExternalDependency, detectLanguage } from '../utils/stdlib-registry.js';

// No início do analyze():
const language = detectLanguage(report.projectInfo);
const projectFiles = new Set(report.dependencyGraph.nodes.map(n => n.id));

// No loop de edges:
for (const edge of report.dependencyGraph.edges) {
  if (isExternalDependency(edge.to, language, projectFiles)) continue;
  // ... resto da lógica
}
```

**Testes necessários:**
- Node builtins (`fs`, `path`, `crypto`, `node:fs`) são filtrados
- Python stdlib (`os`, `sys`, `json`) filtrados quando language=python
- Go stdlib (`fmt`, `net/http`) filtrados quando language=go
- Relative paths (`./utils`, `../shared`) nunca filtrados
- Bare npm packages (`lodash`, `express`) filtrados como external
- Scoped packages (`@org/pkg`) filtrados como external

---

### Fix 0.2 — Language-Aware Extension Map (hub-splitter.ts)

**Problema:** `hub-splitter.ts:53` hardcoda `.py` como extensão fallback, gerando nomes de arquivo Python em projetos TypeScript.

**Arquivo:** `packages/architect-core/src/core/rules/hub-splitter.ts`

**Solução:**

```typescript
// packages/architect-core/src/core/utils/language-utils.ts (NOVO)

const EXTENSION_MAP: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  go: 'go',
  rust: 'rs',
  java: 'java',
};

const COMMENT_SYNTAX: Record<string, { line: string; blockStart: string; blockEnd: string }> = {
  typescript:  { line: '//',  blockStart: '/*',  blockEnd: '*/' },
  javascript:  { line: '//',  blockStart: '/*',  blockEnd: '*/' },
  python:      { line: '#',   blockStart: '"""', blockEnd: '"""' },
  go:          { line: '//',  blockStart: '/*',  blockEnd: '*/' },
  rust:        { line: '//',  blockStart: '/*',  blockEnd: '*/' },
  java:        { line: '//',  blockStart: '/*',  blockEnd: '*/' },
};

const BARREL_FILENAMES: Record<string, string[]> = {
  typescript:  ['index.ts', 'index.tsx', 'mod.ts'],
  javascript:  ['index.js', 'index.mjs', 'index.cjs'],
  python:      ['__init__.py'],
  go:          [], // Go doesn't have barrel files
  rust:        ['mod.rs', 'lib.rs'],
  java:        ['package-info.java'],
};

export function getExtension(language: string): string {
  return EXTENSION_MAP[language] ?? 'txt';
}

export function getCommentSyntax(language: string) {
  return COMMENT_SYNTAX[language] ?? COMMENT_SYNTAX.typescript;
}

export function getBarrelFilenames(language: string): string[] {
  return BARREL_FILENAMES[language] ?? ['index.ts', 'index.js'];
}
```

**Aplicação no hub-splitter.ts:**

```typescript
// ANTES (bugado):
const ext = isDotNotation ? 'py' : (fileName.split('.').pop() || 'py');

// DEPOIS:
import { getExtension } from '../utils/language-utils.js';

const language = detectLanguage(report.projectInfo);
const ext = fileName.includes('.')
  ? (fileName.split('.').pop() || getExtension(language))
  : getExtension(language);
```

---

### Fix 0.3 — Prompt Size Control (offline-prompt-generator.ts)

**Problema:** `offline-prompt-generator.ts:59-74` lê e inline TODOS os arquivos para operações MODIFY sem limite de tamanho. Resultado: prompts de 500KB+ com 52 arquivos, inutilizáveis em qualquer chat UI.

**Arquivo:** `packages/architect-agents/src/core/agent-runtime/offline-prompt-generator.ts`

**Solução:** Implementar sistema de token budget com priorização inteligente e progressive disclosure.

```typescript
// packages/architect-agents/src/core/agent-runtime/prompt-budget.ts (NOVO)

export interface PromptBudgetConfig {
  /** Max estimated tokens per prompt file. Default: 30000 (~120KB text) */
  maxTokensPerPrompt: number;
  /** Max number of full file inlines per step. Default: 5 */
  maxFullFileInlines: number;
  /** Max lines per individual file inline. Default: 300 */
  maxLinesPerFile: number;
  /** Whether to include abbreviated context for overflow files. Default: true */
  includeAbbreviatedContext: boolean;
}

export const DEFAULT_BUDGET: PromptBudgetConfig = {
  maxTokensPerPrompt: 30_000,
  maxFullFileInlines: 5,
  maxLinesPerFile: 300,
  includeAbbreviatedContext: true,
};

/** Rough token estimate: ~4 chars per token */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type OperationPriority = 'core-target' | 'important-context' | 'consumer-ref';

/**
 * Classifica e prioriza operações de um step para prompt generation.
 * - CREATE/SPLIT → core-target (always inline full)
 * - MODIFY com muitas mudanças → important-context (inline if budget allows)
 * - MODIFY simples (import update) → consumer-ref (abbreviated annotation)
 */
export function classifyOperation(op: { type: string; description?: string }): OperationPriority {
  if (op.type === 'CREATE' || op.type === 'SPLIT') return 'core-target';
  if (op.type === 'DELETE') return 'consumer-ref';

  // MODIFY: check if it's a simple import update
  const desc = (op.description || '').toLowerCase();
  const isSimpleUpdate = desc.includes('update import') ||
                         desc.includes('update require') ||
                         desc.includes('find and replace');
  return isSimpleUpdate ? 'consumer-ref' : 'important-context';
}

/**
 * Gera abbreviated context: primeiras 20 linhas + exports + últimas 5 linhas.
 * Suficiente para entender a interface sem gastar token budget.
 */
export function abbreviateFileContent(content: string, ext: string): string {
  const lines = content.split('\n');
  if (lines.length <= 40) return content; // Small enough, include full

  const head = lines.slice(0, 20).join('\n');
  const exports = lines
    .filter(l => /^export\s/.test(l) || /^module\.exports/.test(l) || /^pub\s/.test(l))
    .join('\n');
  const tail = lines.slice(-5).join('\n');

  return [
    head,
    '',
    `// ... (${lines.length - 25} lines omitted — see full file at original path)`,
    '',
    '// === Exported Interface ===',
    exports || '// (no top-level exports detected)',
    '',
    '// === End of File ===',
    tail,
  ].join('\n');
}
```

**Aplicação no offline-prompt-generator.ts:**

```typescript
// Refactor do método generate() para usar budget system:

import {
  DEFAULT_BUDGET, estimateTokens, classifyOperation,
  abbreviateFileContent, type PromptBudgetConfig
} from './prompt-budget.js';

// No loop de operações:
let tokenBudget = config.maxTokensPerPrompt;
let fullFileCount = 0;

// Separar operações por prioridade
const ops = step.operations.map(op => ({
  ...op,
  priority: classifyOperation(op),
}));

// Core targets primeiro, depois important, depois consumer
ops.sort((a, b) => {
  const order = { 'core-target': 0, 'important-context': 1, 'consumer-ref': 2 };
  return order[a.priority] - order[b.priority];
});

for (const op of ops) {
  if (op.type === 'MODIFY') {
    const fileContent = readFileSafe(op.path);
    const tokens = estimateTokens(fileContent);

    if (op.priority === 'core-target' ||
        (op.priority === 'important-context' && tokens < tokenBudget && fullFileCount < config.maxFullFileInlines)) {
      // Full inline com line cap
      const lines = fileContent.split('\n');
      const capped = lines.length > config.maxLinesPerFile
        ? lines.slice(0, config.maxLinesPerFile).join('\n') + `\n// ... truncated (${lines.length} total lines)`
        : fileContent;
      promptContent += `\n### Current State of \`${op.path}\`\n`;
      promptContent += `\`\`\`${ext}\n${capped}\n\`\`\`\n`;
      tokenBudget -= estimateTokens(capped);
      fullFileCount++;
    } else if (config.includeAbbreviatedContext) {
      // Abbreviated: interface-only view
      const abbreviated = abbreviateFileContent(fileContent, ext);
      promptContent += `\n### Interface Summary of \`${op.path}\` (abbreviated)\n`;
      promptContent += `\`\`\`${ext}\n${abbreviated}\n\`\`\`\n`;
      tokenBudget -= estimateTokens(abbreviated);
    } else {
      // Consumer reference only
      promptContent += `\n### \`${op.path}\` — Update imports as described above\n`;
    }
  }
}
```

**Diretiva de resposta aprimorada** (adicionar ao final de cada prompt gerado):

```markdown
## Response Format

Return EACH modified or created file in a separate fenced code block.
The FIRST LINE inside each code block MUST be a comment with the FULL file path.

Example:
\`\`\`typescript
// src/core/repos/user-repo.ts
import { Database } from '../shared/database.js';
// ... rest of file
\`\`\`

Rules:
1. Include the COMPLETE file content, not just diffs
2. One code block per file — never combine multiple files
3. If a file needs no changes, do NOT include it
4. Preserve all existing functionality unless explicitly told to modify it
```

---

### Fix 0.4 — Module Grouper External Dependency Filter (NOVO)

**Problema:** `module-grouper.ts` constrói a co-import matrix usando TODOS os edges, incluindo stdlib e vendor. Resultado: Step #5 do Genesis tentava mover `fs` e `path` para `shared/`.

**Arquivo:** `packages/architect-core/src/core/rules/module-grouper.ts`

**Solução:** Aplicar o mesmo `isExternalDependency` filter que o Hub Splitter.

```typescript
// No método analyze() do ModuleGrouperRule:

import { isExternalDependency, detectLanguage } from '../utils/stdlib-registry.js';

const language = detectLanguage(report.projectInfo);
const projectFiles = new Set(report.dependencyGraph.nodes.map(n => n.id));

// Filtrar edges ANTES de construir a co-import matrix:
const internalEdges = report.dependencyGraph.edges.filter(
  edge => !isExternalDependency(edge.to, language, projectFiles)
);

// Usar internalEdges ao invés de report.dependencyGraph.edges no resto da lógica
```

**Impacto:** Sem este fix, o Genesis continua gerando steps absurdos mesmo com o Hub Splitter corrigido. É tão crítico quanto o Fix 0.1.

---

### Fix 0.5 — Import Organizer External Filter (NOVO)

**Problema:** O `import-organizer.ts` gera facades (`*_deps.ts`) que agrupam imports — mas também agrupa imports externos. Isso cria barrels inúteis tipo:

```typescript
// src/core/architect_deps.ts (gerado)
export { readFileSync } from 'fs';      // ← absurdo
export { join, resolve } from 'path';   // ← absurdo
export { UserRepo } from './repos/user-repo.js'; // ← ok
```

**Arquivo:** `packages/architect-core/src/core/rules/import-organizer.ts`

**Solução:** Mesma abordagem — filtrar external deps antes de gerar facades.

```typescript
// No analyze() do ImportOrganizerRule:
const internalEdges = report.dependencyGraph.edges.filter(
  edge => !isExternalDependency(edge.to, language, projectFiles)
);
```

**Bug adicional na mesma file:** `import-organizer.ts:45` tem o MESMO hardcode `'py'`:
```typescript
const ext = fileName.split('.').pop() || 'py'; // ← mesmo bug do hub-splitter
```
E o `generateFacadeContent()` (linha 86-99) faz branching `if (ext === 'py')` com fallback genérico JS/TS. Precisa usar o `getExtension()` e `getCommentSyntax()` do Fix 0.2 para gerar facades corretas para Go, Rust e Java também.

**Nota:** Este fix não estava no plano original mas é necessário para consistência. Todos os 5 rules do RefactorEngine operam sobre o grafo de dependências — se o grafo inclui external deps, TODOS os rules são potencialmente afetados.

---

### Fix 0.6 — Consumer Follow-up Block nos Prompts Gerados

**Problema:** Quando o Genesis gera um split, os prompts não informam explicitamente quais consumidores precisam de update manual. O LLM que recebe o prompt fica cego sobre o impacto cascata.

**Arquivo:** `packages/architect-agents/src/core/agent-runtime/offline-prompt-generator.ts`

**Solução:** Para cada step, gerar um bloco de follow-up com os consumidores concretos:

```typescript
// Após gerar as operações do step, adicionar:
const consumerOps = step.operations.filter(
  op => op.type === 'MODIFY' && classifyOperation(op) === 'consumer-ref'
);

if (consumerOps.length > 0) {
  promptContent += `\n## ⚠️ Manual Follow-up Required\n\n`;
  promptContent += `After applying the changes above, update the following ${consumerOps.length} consumer file(s):\n\n`;
  for (const op of consumerOps) {
    promptContent += `- \`${op.path}\` — ${op.description || 'Update imports to match new file structure'}\n`;
  }
  promptContent += `\n**Tip:** Use your IDE's Find & Replace across the project.\n`;
  promptContent += `Search for the old import path and replace with the new one shown in the refactored code above.\n`;
}
```

---

### Validação da Fase 0

**Self-test obrigatório:** Após implementar os 6 fixes, rodar o Architect contra o próprio monorepo e verificar que:

1. Nenhum step menciona `fs`, `path`, `crypto`, `os`, ou qualquer stdlib
2. Todas as extensões de arquivo geradas são `.ts` (porque o projeto é TypeScript)
3. Nenhum prompt gerado excede 30K tokens estimados
4. O bloco de follow-up aparece quando há consumers
5. O Module Grouper não tenta mover stdlib para `shared/`

```bash
# Comando de self-test:
npx architect analyze . --json > /tmp/self-analysis.json
npx architect refactor . --dry-run --output-prompts /tmp/genesis-test/

# Verificar:
grep -r "require('fs')\|from 'fs'\|from 'path'" /tmp/genesis-test/
# Deve retornar 0 resultados

wc -c /tmp/genesis-test/*.md
# Nenhum arquivo deve exceder ~120KB (30K tokens × 4 chars)
```

---

## Fase 1 — Genesis Engine Hardening (1 semana)

> **Objetivo:** Tornar o Genesis Engine robusto e confiável com cobertura de testes abrangente.
> **Critério de aceite:** 90%+ coverage nos rules, zero regressões em CI.

### 1.1 — Test Suite para Rules Engine

**Problema atual:** ZERO testes para hub-splitter, module-grouper, barrel-optimizer, import-organizer e dead-code-detector. As únicas rules testadas são via `rules-engine.test.ts` (que testa quality gates, não refactor rules).

**Ação:** Criar test suite dedicada para cada rule.

**Estrutura:**

```
packages/architect-core/tests/rules/
├── hub-splitter.test.ts
├── module-grouper.test.ts
├── barrel-optimizer.test.ts
├── import-organizer.test.ts
├── dead-code-detector.test.ts
├── refactor-engine.integration.test.ts
└── fixtures/
    ├── typescript-project/      # Mock TS project graph
    ├── python-project/          # Mock Python project graph
    ├── go-project/              # Mock Go project graph
    └── mixed-project/           # Multi-language monorepo graph
```

**Casos de teste críticos para hub-splitter.test.ts:**

```typescript
describe('HubSplitterRule', () => {
  // Cenários de filtragem
  it('should NOT generate split for Node.js builtins (fs, path, crypto)');
  it('should NOT generate split for node: prefixed imports');
  it('should NOT generate split for npm packages (lodash, express)');
  it('should NOT generate split for Python stdlib when language=python');
  it('should NOT generate split for Go stdlib when language=go');

  // Cenários positivos
  it('should generate split for internal hub with 8+ incoming deps');
  it('should group dependents by top-level directory correctly');
  it('should use correct file extension for project language');
  it('should exclude barrel files from hub detection');
  it('should exclude type-only files from hub detection');

  // Edge cases
  it('should handle monorepo cross-package dependencies');
  it('should handle files with no directory parent');
  it('should handle circular dependencies gracefully');
  it('should produce valid file paths in operations');
});
```

**Implementação padrão:** Cada teste cria um `AnalysisReport` mock com grafo de dependências controlado. Nenhum I/O real — tudo in-memory.

---

### 1.2 — Test Suite para Offline Prompt Generator

**Estrutura:**

```
packages/architect-agents/tests/
└── offline-prompt-generator.test.ts
```

**Casos de teste:**

```typescript
describe('OfflinePromptGenerator', () => {
  // Budget enforcement
  it('should cap prompt size at maxTokensPerPrompt');
  it('should inline at most maxFullFileInlines complete files');
  it('should abbreviate overflow files to interface-only');
  it('should truncate individual files at maxLinesPerFile');

  // Priorização
  it('should prioritize CREATE operations over MODIFY');
  it('should classify simple import updates as consumer-ref');
  it('should include full content for core-target operations');

  // Follow-up block
  it('should generate consumer follow-up block when consumers exist');
  it('should NOT generate follow-up block when all ops are core-target');

  // Response directive
  it('should include response format instructions in every prompt');
  it('should use correct comment syntax for project language');

  // Edge cases
  it('should handle missing files gracefully');
  it('should handle empty steps');
  it('should generate valid markdown');
});
```

---

### 1.3 — Snapshot Testing para Genesis Output

**Conceito:** Criar fixtures de projetos completos e validar que o output do Genesis permanece estável entre versões.

```typescript
// packages/architect-core/tests/snapshots/genesis-snapshot.test.ts

describe('Genesis Output Stability', () => {
  const fixtures = ['typescript-express-api', 'python-flask-app', 'go-microservice'];

  for (const fixture of fixtures) {
    it(`should produce stable output for ${fixture}`, async () => {
      const report = await analyzeFixture(fixture);
      const plan = new RefactorEngine().analyze(report, `/fixtures/${fixture}`);

      // Snapshot do plano (sem timestamps)
      const normalized = normalizePlan(plan);
      expect(normalized).toMatchSnapshot();
    });
  }
});
```

---

### 1.4 — Configuração de Budget via architect.config

**Ação:** Expor o `PromptBudgetConfig` no `ArchitectConfig` para que usuários possam customizar limites.

```typescript
// Adicionar a ArchitectConfig em core.ts:
export interface ArchitectConfig {
  // ... existing fields
  genesis?: {
    maxTokensPerPrompt?: number;
    maxFullFileInlines?: number;
    maxLinesPerFile?: number;
    includeAbbreviatedContext?: boolean;
    /** Target model context window (affects budget calculation) */
    targetModel?: 'gpt-4o' | 'claude-3' | 'gemini-pro' | 'custom';
    /** Custom token limit when targetModel is 'custom' */
    customTokenLimit?: number;
  };
}
```

**Presets por modelo:**

```typescript
const MODEL_PRESETS: Record<string, Partial<PromptBudgetConfig>> = {
  'gpt-4o':     { maxTokensPerPrompt: 40_000 },  // 128K context
  'claude-3':   { maxTokensPerPrompt: 60_000 },  // 200K context
  'gemini-pro': { maxTokensPerPrompt: 100_000 }, // 1M context
};
```

---

### 1.5 — CI Gate para Genesis Quality

**Ação:** Adicionar step no CI que roda o Genesis contra um fixture project e valida a saída.

```yaml
# .github/workflows/ci.yml — adicionar job:
genesis-validation:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20 }
    - run: npm ci && npm run build
    - run: |
        # Generate prompts against fixture
        node packages/architect/dist/src/adapters/cli.js refactor \
          tests/fixtures/typescript-express-api \
          --dry-run --output-prompts /tmp/genesis-test/

        # Validate: no stdlib references
        if grep -rq "from 'fs'\|from 'path'\|from 'os'" /tmp/genesis-test/; then
          echo "FAIL: Genesis output contains stdlib references"
          exit 1
        fi

        # Validate: no prompt exceeds 120KB
        for f in /tmp/genesis-test/*.md; do
          size=$(wc -c < "$f")
          if [ "$size" -gt 122880 ]; then
            echo "FAIL: $f exceeds 120KB ($size bytes)"
            exit 1
          fi
        done

        echo "Genesis validation passed"
```

---

## Fase 2 — Architectural Refinement (2 semanas)

> **Objetivo:** Eliminar dívida técnica identificada na auditoria e elevar type safety.
> **Critério de aceite:** Coverage > 90% branches, zero `any` em APIs públicas.

### 2.1 — Centralizar Filtragem de External Dependencies

**Problema:** Após os fixes da Fase 0, o filtro de external deps é aplicado individualmente em cada rule. Isso é frágil — qualquer nova rule pode esquecer de aplicar o filtro.

**Solução:** Mover a filtragem para o `RefactorEngine` antes de passar o report para as rules.

```typescript
// packages/architect-core/src/core/refactor-engine.ts

export class RefactorEngine {
  analyze(report: AnalysisReport, projectPath: string): RefactoringPlan {
    // NOVO: Pre-process - filter external dependencies from graph
    const cleanedReport = this.filterExternalDependencies(report);

    // Agora todas as rules recebem um grafo limpo automaticamente
    for (const rule of this.rules) {
      steps.push(...rule.analyze(cleanedReport, projectPath));
    }
    // ...
  }

  private filterExternalDependencies(report: AnalysisReport): AnalysisReport {
    const language = detectLanguage(report.projectInfo);
    const projectFiles = new Set(report.dependencyGraph.nodes.map(n => n.id));

    return {
      ...report,
      dependencyGraph: {
        ...report.dependencyGraph,
        edges: report.dependencyGraph.edges.filter(
          edge => !isExternalDependency(edge.to, language, projectFiles)
        ),
        // Also remove external nodes
        nodes: report.dependencyGraph.nodes.filter(
          node => !isExternalDependency(node.id, language, projectFiles)
        ),
      },
    };
  }
}
```

**Impacto:** Simplifica cada rule (removendo filtros duplicados), garante consistência, e protege rules futuras automaticamente.

---

### 2.2 — Eliminar Mutable State do Scorer

**Problema:** `ArchitectureScorer` usa `this.modularity`, `this.coupling`, etc. como estado mutável. Não é thread-safe e dificulta testabilidade.

**Solução:** Refatorar para função pura que retorna resultado sem side effects.

```typescript
// ANTES:
export class ArchitectureScorer {
  private modularity = 0;
  private coupling = 0;
  // ...
  score(edges, patterns, fileCount) {
    this.modularity = this.calculateModularity(edges, fileCount);
    // mutates state...
  }
}

// DEPOIS:
export class ArchitectureScorer {
  score(edges: DependencyEdge[], patterns: AntiPattern[], fileCount: number): ArchitectureScore {
    const modularity = this.calculateModularity(edges, fileCount);
    const coupling = this.calculateCoupling(edges, fileCount);
    const cohesion = this.calculateCohesion(edges, fileCount);
    const layering = this.calculateLayering(patterns);

    const overall =
      modularity * 0.40 +
      coupling   * 0.25 +
      cohesion   * 0.20 +
      layering   * 0.15;

    return {
      overall: Math.round(overall * 100) / 100,
      components: [
        { name: 'Modularity', score: modularity, weight: 0.40 },
        { name: 'Coupling',   score: coupling,   weight: 0.25 },
        { name: 'Cohesion',   score: cohesion,   weight: 0.20 },
        { name: 'Layering',   score: layering,   weight: 0.15 },
      ],
      breakdown: { modularity, coupling, cohesion, layering },
    };
  }
}
```

---

### 2.3 — Type Safety nas APIs Públicas

**Problema:** `AntiPatternDetector.setCustomDetectors(detectors: any[])` — API pública com `any[]`.

**Solução:**

```typescript
// Definir interface para custom detectors:
export interface CustomAntiPatternDetector {
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  detect(report: AnalysisReport): AntiPattern[];
}

// Substituir:
setCustomDetectors(detectors: CustomAntiPatternDetector[]): void;
```

**Ação adicional:** Auditoria completa de `any` em todos os exports públicos:

```bash
# Find all public any types:
grep -rn "export.*any" packages/*/src/ --include="*.ts" | grep -v node_modules | grep -v dist
```

---

### 2.4 — Eliminar Barrel Anti-Pattern em architect_deps.ts

**Problema:** O Architect usa um barrel `architect_deps.ts` que ele próprio deveria detectar como anti-pattern. É irônico e prejudica a credibilidade.

**Solução:** Eliminar o barrel e usar imports diretos no `architect.ts`:

```typescript
// ANTES:
import { ProjectScanner, ArchitectureAnalyzer, ... } from './architect_deps.js';

// DEPOIS:
import { ProjectScanner } from './scanner.js';
import { ArchitectureAnalyzer } from './analyzers/architecture-analyzer.js';
import { ArchitectureScorer } from './scorer.js';
import { AntiPatternDetector } from './anti-patterns.js';
import { detectLayers } from './layers.js';
// etc.
```

---

### 2.5 — Strict TypeScript Completo

**Problema:** `tsconfig.base.json` atual tem `noUnusedLocals: true` e `noUnusedParameters: true` — bom. Mas falta `exactOptionalPropertyTypes: true` e `noUncheckedIndexedAccess: true`.

**Solução:**

```json
{
  "compilerOptions": {
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
```

**Impacto:** Força tratamento explícito de `undefined` em acessos a arrays/maps, eliminando uma classe inteira de runtime errors.

---

### 2.6 — Performance: Edge Filtering com Pre-computed Index

**Problema:** Cada rule itera sobre TODOS os edges para filtrar/contar. Com projetos grandes (10K+ files), isso é O(R × E) onde R = rules, E = edges.

**Solução:** Pre-computar índices no RefactorEngine:

```typescript
interface DependencyIndex {
  /** Edges grouped by target file */
  incomingByFile: Map<string, DependencyEdge[]>;
  /** Edges grouped by source file */
  outgoingByFile: Map<string, DependencyEdge[]>;
  /** Fan-in count per file */
  fanIn: Map<string, number>;
  /** Fan-out count per file */
  fanOut: Map<string, number>;
}

function buildDependencyIndex(edges: DependencyEdge[]): DependencyIndex {
  const incomingByFile = new Map<string, DependencyEdge[]>();
  const outgoingByFile = new Map<string, DependencyEdge[]>();

  for (const edge of edges) {
    if (!incomingByFile.has(edge.to)) incomingByFile.set(edge.to, []);
    incomingByFile.get(edge.to)!.push(edge);
    if (!outgoingByFile.has(edge.from)) outgoingByFile.set(edge.from, []);
    outgoingByFile.get(edge.from)!.push(edge);
  }

  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const [file, edges] of incomingByFile) fanIn.set(file, edges.length);
  for (const [file, edges] of outgoingByFile) fanOut.set(file, edges.length);

  return { incomingByFile, outgoingByFile, fanIn, fanOut };
}
```

Passar o index como parâmetro para as rules via interface expandida:

```typescript
export interface RefactorRule {
  name: string;
  tier: 1 | 2;
  analyze(report: AnalysisReport, projectPath: string, index?: DependencyIndex): RefactorStep[];
}
```

---

## Fase 3 — Strategic Evolution (4-6 semanas)

> **Objetivo:** Funcionalidades que tornam o Architect único no mercado.
> **Meta:** Nenhum concorrente oferece esse nível de análise + Genesis + forecast.

### 3.1 — Genesis Engine v2: Multi-Pass Prompt Generation

**Conceito:** Em vez de gerar 1 prompt monolítico por step, gerar uma **cadeia de prompts** que se alimentam sequencialmente. Isso permite refactorings complexos que nenhum LLM consegue fazer em um único prompt.

**Arquitetura:**

```
Step 1: "Extract interfaces"
  └── Prompt 1A: "Analyze this module and list all implicit interfaces"
  └── Prompt 1B: "Given these interfaces, generate the .ts interface files"
  └── Prompt 1C: "Update all consumers to import from the new interface files"

Step 2: "Split hub module"
  └── Prompt 2A: "Analyze dependencies and propose domain split boundaries"
  └── Prompt 2B: "Generate the split modules" (receives 2A output as context)
  └── Prompt 2C: "Update imports in consumer files"
```

**Diferencial:** Nenhuma ferramenta de mercado faz multi-pass prompt generation para refactoring. É um salto conceitual — transforma o Genesis de "gerador de prompts" em "orquestrador de refactoring via LLM".

**Implementação:**

```typescript
export interface PromptChain {
  stepId: number;
  passes: PromptPass[];
}

export interface PromptPass {
  passNumber: number;
  objective: string;
  context: string;         // O que este pass recebe
  outputContract: string;  // O que este pass DEVE retornar
  dependsOn?: number;      // Pass anterior cujo output alimenta este
  content: string;         // O prompt real
}
```

---

### 3.2 — Architecture Forecast v2: ML-Based Prediction

**Estado atual:** O `forecast.ts` usa heurísticas para prever módulos problemáticos. Funciona, mas é baseado em thresholds estáticos.

**Evolução:** Usar git history + dependency graph evolution para treinar um modelo de regressão simples que prevê architectural decay.

```typescript
export interface ArchitectureForecast {
  /** Modules predicted to become anti-patterns in next N commits */
  atRisk: RiskPrediction[];
  /** Estimated days until next anti-pattern emergence */
  timeToNextAntiPattern: number;
  /** Trend: improving, stable, or degrading */
  trend: 'improving' | 'stable' | 'degrading';
  /** Confidence score 0-1 */
  confidence: number;
}

export interface RiskPrediction {
  file: string;
  currentScore: number;
  predictedScore: number;
  predictedAntiPattern: string;
  riskFactors: string[];
  /** Number of commits until predicted degradation */
  horizon: number;
}
```

**Features para o modelo:**
- Velocity of change (commits/week por arquivo)
- Fan-in growth rate
- Coupling coefficient change rate
- Lines of code growth rate
- Number of distinct authors (bus factor proxy)
- Distance from nearest anti-pattern threshold

**Diferencial:** Nenhum tool de mercado faz **prediction temporal** de architectural degradation. SonarQube mostra o estado atual. O Architect mostraria o **futuro**.

---

### 3.3 — Interactive Refactoring Mode

**Conceito:** Modo interativo onde o Architect gera um step, o usuário aplica (via Genesis ou manualmente), e o Architect re-analisa para gerar o próximo step baseado no estado atualizado.

```
$ architect refactor . --interactive

📊 Current Score: 62/100

Step 1/5: Split hub module src/core/architect.ts
  → 3 prompts generated in ./prompts/step-1/

  [Apply] [Skip] [Modify] [Stop]

> Apply

  ✅ Step 1 applied. Re-analyzing...
  📊 New Score: 68/100 (+6)

Step 2/5: Optimize barrel imports
  → 2 prompts generated in ./prompts/step-2/
  ...
```

**Diferencial:** Feedback loop em tempo real. O Architect vê o resultado de cada step e adapta os próximos. Nenhum concorrente oferece isso.

---

### 3.4 — Plugin Marketplace para Custom Rules

**Estado atual:** `AntiPatternDetector` aceita custom detectors via `setCustomDetectors()`. Mas a API é `any[]` e não existe formato de plugin.

**Evolução:** Definir plugin spec + discovery + marketplace.

```typescript
// architect-plugin.json (na raiz de cada plugin)
{
  "name": "@company/architect-plugin-react",
  "version": "1.0.0",
  "architect": ">=8.0.0",
  "provides": {
    "rules": ["react-prop-drilling", "react-context-sprawl"],
    "antiPatterns": ["excessive-rerenders", "prop-type-drift"],
    "scoring": {
      "metrics": ["react-component-cohesion"],
      "weight": 0.1
    }
  },
  "entry": "./dist/index.js"
}
```

**Plugin Interface:**

```typescript
export interface ArchitectPlugin {
  name: string;
  version: string;

  // Optional: custom refactoring rules
  rules?: RefactorRule[];

  // Optional: custom anti-pattern detectors
  antiPatterns?: CustomAntiPatternDetector[];

  // Optional: additional scoring metrics
  scoring?: {
    metrics: ScoringMetric[];
    /** Weight of this plugin's metrics in overall score (0-1) */
    weight: number;
  };

  // Optional: lifecycle hooks
  onAnalyzeStart?(config: ArchitectConfig): void;
  onAnalyzeEnd?(report: AnalysisReport): AnalysisReport;
}
```

**Diferencial:** Extensibilidade enterprise. Cada empresa pode criar rules específicas para seus padrões internos.

---

### 3.5 — Consensus Validation para Genesis Output

**Conceito:** Antes de finalizar os prompts, rodar uma validação que verifica se as operações propostas são consistentes:

```typescript
export class GenesisValidator {
  validate(plan: RefactoringPlan): ValidationResult {
    const issues: ValidationIssue[] = [];

    // 1. Circular operation detection
    // Se Step 2 modifica um arquivo que Step 1 cria, a ordem está correta?

    // 2. Orphan detection
    // Alguma operação MOVE deixa imports broken?

    // 3. Completeness check
    // Para cada SPLIT, todos os consumers têm operação MODIFY correspondente?

    // 4. Path collision detection
    // Duas operações tentam criar o mesmo arquivo?

    // 5. Scope validation
    // Operações referenciam apenas arquivos que existem no projeto?

    return { valid: issues.length === 0, issues };
  }
}
```

---

### 3.6 — VSCode Extension Enhancement

**Estado atual:** `packages/architect-vscode` existe mas não foi explorado a fundo na auditoria.

**Evolução:**
- **Inline annotations**: Mostrar score por arquivo diretamente no editor
- **Code lens**: "This file is a Hub (12 dependents) — Click to split"
- **Forecast overlay**: Highlight files at risk of becoming anti-patterns
- **Genesis integration**: Right-click → "Generate refactoring prompt for this module"
- **Diff preview**: Ver o que o Genesis propõe antes de gerar os prompts

---

## Roadmap Consolidado

```
Semana 1:
  ├── Fase 0: 6 Critical Fixes
  └── Fase 1.1-1.2: Test suites para rules + generator

Semana 2:
  ├── Fase 1.3-1.5: Snapshots, config, CI gate
  └── Fase 2.1-2.2: Centralizar filtragem, eliminar mutable state

Semana 3:
  ├── Fase 2.3-2.4: Type safety, eliminar barrel
  └── Fase 2.5-2.6: Strict TS, performance index

Semana 4-5:
  ├── Fase 3.1: Genesis v2 (multi-pass)
  └── Fase 3.5: Genesis Validator

Semana 6-7:
  ├── Fase 3.2: Forecast v2 (ML-based)
  └── Fase 3.3: Interactive mode

Semana 8-9:
  ├── Fase 3.4: Plugin marketplace
  └── Fase 3.6: VSCode extension
```

---

## Métricas de Sucesso

| Métrica | Atual | Após Fase 0-1 | Após Fase 2 | Meta v9.0 |
|---------|-------|---------------|-------------|-----------|
| Genesis output válido | ~30% | 95%+ | 99%+ | 99.5%+ |
| Test coverage (branches) | 76.58% | 85%+ | 92%+ | 95%+ |
| Public API `any` count | ~5 | ~5 | 0 | 0 |
| Max prompt size (tokens) | ∞ (500K+) | 30K | 30K (configurable) | Model-aware |
| Languages supported correctly | 1 (partial) | 6 | 6 | 6 + extensível |
| Time to analyze 10K files | Unknown | Baseline | -30% | -50% |
| Self-analysis clean | ❌ | ✅ | ✅ | ✅ |

---

## Princípios Guia

1. **Eat your own dog food.** O Architect deve passar clean quando roda contra si mesmo. Sempre.
2. **Fail loud, not silent.** Quando o Genesis não consegue gerar um prompt adequado, deve dizer porquê — não gerar lixo silenciosamente.
3. **Language-first, not language-last.** Toda feature nova deve considerar as 6 linguagens desde o design, não como afterthought.
4. **Budget over dump.** Nunca fazer dump de conteúdo sem budget. Vale para prompts, reports, e qualquer output.
5. **Test the output, not just the code.** Snapshot tests no Genesis output são tão importantes quanto unit tests nas rules.
