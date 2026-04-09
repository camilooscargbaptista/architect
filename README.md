# Architect Genesis

<p align="center">
  <img src="assets/cover.png" alt="Architect Genesis" width="600" />
</p>

**Architecture scoring and refactoring across 7 languages using AST analysis.**

[![npm](https://img.shields.io/npm/v/@girardelli/architect?color=blue)](https://www.npmjs.com/package/@girardelli/architect)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-1868%20passing-22c55e.svg)]()
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<p align="center">
  <img src="assets/demo.gif" alt="Architect CLI Demo" width="800" />
</p>

Point it at any codebase. It builds the dependency graph, scores your architecture 0-100, detects anti-patterns, and can refactor autonomously with AI.

---

## Quick Start

```bash
npm install -g @girardelli/architect

# Analyze your project
architect analyze ./src

# Validate against your rules
architect check ./src

# Predict architecture decay
architect forecast ./src

# Refactor with AI assistance
architect execute ./src
```

No config needed to start. It infers your stack, framework, and domain automatically.

---

## What It Does

### AST Analysis (7 Languages)

Parses your codebase using [Tree-Sitter](https://tree-sitter.github.io/tree-sitter/) AST:

**TypeScript** · **Python** · **Go** · **Java** · **Rust** · **Ruby** · **PHP**

Builds a full dependency graph, detects architectural layers (View, Core, Data, Infrastructure), and infers your stack and domain.

### Architecture Score (0-100) — Adaptive

Scores your project on four weighted dimensions. Weights adapt automatically to your stack:

| Dimension | Default | Frontend SPA | Backend Monolith | Microservices |
|-----------|---------|-------------|-----------------|---------------|
| Modularity | 40% | 35% | 35% | 30% |
| Coupling | 25% | 15% | 30% | 20% |
| Cohesion | 20% | 35% | 15% | 25% |
| Layering | 15% | 15% | 20% | 25% |

6 built-in profiles: `default`, `frontend-spa`, `backend-monolith`, `microservices`, `data-pipeline`, `library`. Auto-detected from your frameworks, or set explicitly in `.architect.json`:

```json
{ "scoringProfile": "frontend-spa" }
```

### Anti-Pattern Detection

Finds structural problems from the AST — not heuristics:

- **God Classes** — files with too many dependents
- **Circular Dependencies** — import cycles between modules
- **Leaky Abstractions** — layer boundary violations
- **Spaghetti Modules** — high coupling with no clear interface

### Architecture Rules (`.architect.rules.yml`)

Declare your architecture rules in YAML. Validate in CI with `architect check`:

```yaml
quality_gates:
  min_overall_score: 60
  max_critical_anti_patterns: 0
  max_high_anti_patterns: 3

boundaries:
  allow_circular_dependencies: false
  banned_imports:
    - from: "presentation/*"
      to: "infrastructure/*"
    - from: "domain/*"
      to: "framework/*"
```

```bash
architect check ./src
# Exit code 0 = pass, 1 = fail → plug into CI/CD
```

### Refactoring Plan

Generates a tiered plan with 5 rule-based transformations:

1. **Hub Splitting** — breaks God Classes into focused modules
2. **Barrel Optimization** — cleans up index/init file re-exports
3. **Import Organization** — restructures import paths
4. **Module Grouping** — reorganizes related files
5. **Dead Code Detection** — finds unreferenced exports

### AI-Assisted Execution

`architect execute` runs refactoring steps using Claude, GPT, or Gemini:

- Human gating on every step: **approve / skip / retry / rollback**
- Creates a protective git branch before changes
- Each approved step gets its own commit
- Switch AI provider mid-execution if one gives bad results

### Architecture Knowledge Base

Every `architect analyze` run is automatically persisted to a local SQLite database (`.architect/knowledge-base.sqlite`). Zero config — just keep analyzing and the KB tracks your history.

```bash
architect kb history .     # Score timeline with visual bars
architect kb trends .      # Recurring anti-patterns over time
architect kb stats         # Projects, analyses, DB size
architect kb export .      # Full history as JSON
architect kb context .     # Generate LLM-ready summary
```

Supports Architecture Decision Records (ADRs), validation tracking, and forecast history. The `kb context` command generates a text summary you can inject into AI prompts for architecture-aware code generation.

### Self-Improving Loop

The analysis engine learns from your project history. When you run `architect check`, it:

- Persists violations as constraints in the Knowledge Base
- Detects score regressions and emits `score.degraded` events
- Suggests governance rules based on recurring patterns

```bash
architect rules suggest .   # Show rule suggestions with confidence levels
architect rules apply .     # Auto-apply high-confidence suggestions
```

### Architecture Agents

Four autonomous agents for different architecture tasks:

- **Review Agent** — analyzes project state against rules, detects regressions
- **Forecast Agent** — predicts score trends using linear regression on KB history
- **Refactor Agent** — generates and optionally executes refactoring plans
- **Scaffold Agent** — generates module templates matching your detected architecture style

```typescript
import { agentRegistry } from '@girardelli/architect-agents';

const result = await agentRegistry.execute('review-agent', {
  projectPath: './my-project',
  autoMode: false,
  verbose: true,
});
```

### MCP Server (Model Context Protocol)

Expose all architecture tools to any MCP-compatible LLM client:

```bash
# Add to Claude Code config
npx @girardelli/architect-mcp
```

9 tools available: `analyze_project`, `get_score`, `get_anti_patterns`, `check_rules`, `query_kb`, `suggest_refactoring`, `suggest_rules`, `get_kb_context`, `create_from_document`.

Works with Claude Code, Cursor, Windsurf, and any MCP client.

### Genesis from Scratch

`architect genesis-create` takes a requirements document and generates a complete project scaffold with architecture decisions baked in:

```bash
# From a requirements file
architect genesis-create requirements.md --output ./projects

# From inline text
architect genesis-create "E-commerce platform with products, orders, payments via Stripe"
```

The pipeline: **Requirements Document → NLP Parser → Architecture Blueprint → Project Scaffold**

- Parses entities, bounded contexts, integrations, workflows from natural language
- Selects architecture style (clean architecture, hexagonal, modular monolith, etc.) based on project complexity
- Infers stack decisions (language, framework, ORM, libraries)
- Generates real source files: controllers, services, repositories, entities, DTOs
- Creates `.architect.rules.yml` and `.architect.json` for governance from day one
- Also available as MCP tool: `create_from_document`

### Architecture Forecast

`architect forecast` reads your git history and predicts score decay:

- Velocity-adjusted scoring from commit history
- ML-based regression projecting 3-6 months ahead
- Identifies which modules are trending downward

---

## GitHub Actions

Drop this into `.github/workflows/architecture-review.yml` for automated PR reviews:

```yaml
name: Architecture Review
on: [pull_request]
jobs:
  architect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: camilooscargbaptista/architect@v8
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

---

## VS Code Extension

Install **Architect Intelligence** from the VS Code Marketplace:

- CodeLens integration showing architecture scores inline
- Commands: analyze, refactor, forecast, show anti-patterns
- Inline hub detection and scoring

---

## Packages

Monorepo with npm workspaces. Use the full CLI or just the core engine:

| Package | Description |
|---------|-------------|
| [`@girardelli/architect`](packages/architect/) | CLI, GitHub Actions adapter, HTML/JSON/Markdown reports |
| [`@girardelli/architect-core`](packages/architect-core/) | AST parsing, scoring engine, rules engine, anti-pattern detection |
| [`@girardelli/architect-agents`](packages/architect-agents/) | AI execution runtime, architecture agents, stack/framework detection |
| [`@girardelli/architect-mcp`](packages/architect-mcp/) | MCP Server — expose architecture tools to any LLM (Claude Code, Cursor, etc.) |

---

## All Commands

| Command | Description |
|---------|-------------|
| `architect analyze .` | Full analysis with HTML/JSON/Markdown report |
| `architect check .` | Validate against `.architect.rules.yml` (CI/CD) |
| `architect execute .` | AI-assisted refactoring with human gating |
| `architect forecast .` | ML-based score decay prediction |
| `architect refactor .` | Generate refactoring plan |
| `architect score .` | Quick score output |
| `architect anti-patterns .` | List detected anti-patterns |
| `architect layers .` | Show layer classification |
| `architect kb list` | List tracked projects in Knowledge Base |
| `architect kb history .` | Show score timeline for a project |
| `architect kb trends .` | Show anti-pattern trends over time |
| `architect kb export .` | Export full project history as JSON |
| `architect kb context .` | Generate LLM context summary |
| `architect rules suggest .` | Suggest governance rules from KB history |
| `architect rules apply .` | Auto-apply high-confidence rule suggestions |
| `architect agents .` | Generate/audit `.agent/` directory |
| `architect pr-review .` | GitHub Actions PR review |
| `architect diagram .` | Generate architecture diagram |
| `architect genesis .` | Interactive TUI terminal |
| `architect genesis-create <file>` | Create project from requirements document |

---

## Contributing

```bash
git clone https://github.com/camilooscargbaptista/architect.git
cd architect
npm install
npm run build
npm test
```

---

## License

MIT
