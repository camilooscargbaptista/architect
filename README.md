# Architect Genesis

<p align="center">
  <img src="assets/cover.png" alt="Architect Genesis" width="600" />
</p>

**Architecture scoring and refactoring across 7 languages using AST analysis.**

[![npm](https://img.shields.io/npm/v/@girardelli/architect?color=blue)](https://www.npmjs.com/package/@girardelli/architect)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-440%20passing-22c55e.svg)]()
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

### Architecture Score (0-100)

Scores your project on four weighted dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|------------------|
| Modularity | 40% | How well-separated are your modules |
| Coupling | 25% | Cross-boundary dependency count |
| Cohesion | 20% | How related are elements within a module |
| Layering | 15% | Clean layer separation |

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
| [`@girardelli/architect-agents`](packages/architect-agents/) | AI execution runtime, stack/framework detection, domain inference |

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
| `architect agents .` | Generate/audit `.agent/` directory |
| `architect pr-review .` | GitHub Actions PR review |
| `architect diagram .` | Generate architecture diagram |
| `architect genesis .` | Interactive TUI terminal |

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
