# Architect

**Generate AI agent systems that actually understand your codebase**

[![npm version](https://img.shields.io/npm/v/@girardelli/architect)](https://www.npmjs.com/package/@girardelli/architect)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-411%20passing-22c55e.svg)]()
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Architect scans your codebase, scores its architecture (0-100), predicts future problems using **Temporal Intelligence**, and generates a complete **`.agent/` directory** with 28+ files — agents, rules, guards, workflows, templates, and skills — all calibrated to your specific tech stack, business domain, and architectural patterns.

One command. Zero config. Works on any project.

```bash
npx @girardelli/architect analyze ./
```

---

## What's New in v5.0

### 🧠 Temporal Intelligence Engine
Architect now reads your **Git history** to understand how your architecture is evolving:

- **Velocity Vectors** — Measures growth rate per file (lines/week)
- **Churn Detection** — Identifies files that change too frequently
- **Pre-Anti-Pattern Detection** — Warns you about problems *before* they exist
- **Architecture Weather Forecast** — Predicts architectural health trends

```
☀️ "Module X is stable — no changes in 4 weeks"
⛈️ "File Y is growing at +40 lines/week — will become a God Class in 3 sprints"
```

### 🏗️ Full Monorepo Support
- Automatic workspace detection (`workspaces`, `packages/*/package.json`)
- Semantic package boundary resolution
- Real module graph between packages
- Per-package and aggregate scoring

### 🤖 Enhanced Agent Generation (28+ files)
- **Skills Generator** — Detects patterns (adapters, factories, repositories) and generates `skills/PROJECT-PATTERNS.md`
- **Hooks Generator** — Pre-commit, pre-push, and post-analysis hooks
- **Stack-aware everything** — A Python/FastAPI project gets pytest, a Go project gets `go test`, a NestJS project gets Jest — automatically

### 📊 Premium HTML Report
Dark-themed, responsive report with interactive D3.js dependency graph, health radar, anti-pattern impact map (bubble chart), and collapsible refactoring steps.

---

## Quick Start

```bash
# Analyze your project (generates HTML report)
npx @girardelli/architect analyze ./

# Get architecture score (0-100)
npx @girardelli/architect score ./

# Generate refactoring plan
npx @girardelli/architect refactor ./

# Generate AI agent framework
npx @girardelli/architect agents ./
```

## Core Capabilities

### Architecture Analysis & Scoring

Architect produces a quality score (0-100) across four dimensions:

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| **Modularity** | 40% | File organization, separation of concerns |
| **Coupling** | 25% | Dependency density, fan-in/fan-out |
| **Cohesion** | 20% | Related code proximity, focused modules |
| **Layering** | 15% | Proper layer separation (API→Service→Data) |

Anti-pattern detection includes: **God Class**, **Circular Dependencies**, **Leaky Abstractions**, **Feature Envy**, and **Shotgun Surgery** — with severity levels (Critical, High, Medium) and exact file locations.

### Temporal Intelligence

The v5 engine mines your Git history (last 24 weeks) to produce signals that feed into scoring, forecasting, and refactoring prioritization:

- **Trend-weighted scoring** — Files that are deteriorating get penalized more heavily
- **Bus factor analysis** — Identifies single-author risk zones
- **Churn vs. complexity correlation** — High-churn + high-complexity = highest priority refactor

### Refactoring Plan

Each analysis produces a tiered plan with score impact predictions:

- **Tier 1** — Quick wins (low-risk, immediate impact)
- **Tier 2** — Strategic refactoring (architecture-level benefits)
- Every step includes before/after score predictions and specific file operations (CREATE, MOVE, MODIFY, DELETE)

### Context-Aware Agent System

This is Architect's unique differentiator. The `.agent/` directory it generates isn't generic — it's deeply customized to your project.

**What gets generated (28+ files):**

```
.agent/
├── INDEX.md                              # Project overview with situational dispatch
├── agents/
│   ├── AGENT-ORCHESTRATOR.md             # 5-phase protocol, dispatch table
│   ├── {STACK}-BACKEND-DEVELOPER.md      # Stack-specific backend agent
│   ├── {FRAMEWORK}-FRONTEND-DEVELOPER.md # Framework-specific frontend agent
│   ├── FLUTTER-UI-DEVELOPER.md           # (if mobile detected)
│   ├── DATABASE-ENGINEER.md              # (if database detected)
│   ├── SECURITY-AUDITOR.md               # STRIDE threats, compliance
│   ├── QA-TEST-ENGINEER.md               # Coverage, test scenarios
│   └── TECH-DEBT-CONTROLLER.md           # Score targets, anti-pattern tracking
├── rules/
│   ├── 00-general.md                     # Golden rules (stack-aware)
│   ├── 01-architecture.md                # Anti-pattern prevention
│   ├── 02-security.md                    # OWASP, secrets, input validation
│   └── 03-{stack}.md                     # Stack-specific rules
├── guards/
│   ├── PREFLIGHT.md                      # Pre-action checklist
│   ├── QUALITY-GATES.md                  # Build/test/coverage/score gates
│   └── CODE-REVIEW-CHECKLIST.md          # Domain-specific review items
├── workflows/
│   ├── new-feature.md                    # Feature development workflow
│   ├── fix-bug.md                        # Bug fix workflow
│   └── review.md                         # Code review workflow
├── templates/
│   ├── C4.md                             # Architecture (framework-aware Level 4)
│   ├── BDD.md                            # BDD scenarios (domain-aware)
│   ├── TDD.md                            # TDD examples (stack-specific)
│   ├── ADR.md                            # Decision records
│   └── THREAT-MODEL.md                   # STRIDE model (domain-specific)
├── skills/
│   ├── PROJECT-PATTERNS.md               # Detected patterns
│   ├── ARCHITECT-INTEGRATION.md          # CI integration guide
│   └── CI-PIPELINE.md                    # Pipeline configuration
└── hooks/
    ├── pre-commit.sh                     # Pre-commit validation
    ├── pre-push.sh                       # Pre-push checks
    └── post-analysis.sh                  # Post-analysis automation
```

**What makes it context-aware:**

A Python/FastAPI project gets `pytest` in TDD, `class ABC` in C4, SQLAlchemy in ADR, and `pytest` in quality gates. A TypeScript/NestJS project gets Jest, `interface`, TypeORM/Prisma, and `npm run build`. A Go project gets `go test`, GORM, and `go build`. The same command produces fundamentally different output based on what it detects.

**Domain inference** detects your business domain (fintech, healthtech, e-commerce, tax, HR) from project metadata and generates domain-specific BDD scenarios, threat models, and compliance requirements (LGPD, PCI-DSS, HIPAA, SOX).

## CLI Commands

| Command | Description |
|---------|-------------|
| `architect analyze [path]` | Full analysis → HTML report |
| `architect agents [path]` | Generate/audit `.agent/` directory |
| `architect score [path]` | Quick architecture score (0-100) |
| `architect refactor [path]` | Standalone refactoring plan |
| `architect anti-patterns [path]` | Detect anti-patterns |
| `architect layers [path]` | Layer structure analysis |
| `architect diagram [path]` | Mermaid dependency diagram |

### Output Formats

```bash
architect analyze ./src                           # HTML report (default)
architect analyze ./src --output docs/report.html # Custom path
architect analyze ./src --format json             # JSON output
architect analyze ./src --format markdown         # Markdown output
```

## Configuration

Create `.architect.json` in your project root:

```json
{
  "ignore": ["node_modules", "dist", ".git", "coverage", "__pycache__", ".venv"],
  "frameworks": { "detect": true },
  "antiPatterns": {
    "godClass": { "linesThreshold": 500, "methodsThreshold": 10 },
    "shotgunSurgery": { "changePropagationThreshold": 8 }
  },
  "score": {
    "modularity": 0.40,
    "coupling": 0.25,
    "cohesion": 0.20,
    "layering": 0.15
  }
}
```

## Supported Languages & Frameworks (61)

| Ecosystem | Frameworks |
|-----------|-----------|
| **Node.js/TypeScript** | NestJS, Express, Fastify, Koa, Hapi, Next.js, Nuxt |
| **Python** | FastAPI, Django, Flask, Starlette, Sanic, Litestar, aiohttp, Tornado, DRF |
| **Java/Kotlin** | Spring Boot, Quarkus, Micronaut, Ktor |
| **Go** | Gin, Echo, Fiber, Chi, Gorilla Mux |
| **Rust** | Actix Web, Axum, Rocket |
| **Ruby** | Ruby on Rails, Sinatra |
| **PHP** | Laravel, Symfony, Slim |
| **Dart/Flutter** | Flutter, Shelf, Dart Frog |
| **ORM/Database** | TypeORM, Prisma, Sequelize, Mongoose, Knex, Drizzle, SQLAlchemy, SQLModel, Tortoise ORM, Peewee |
| **Testing** | Jest, Vitest, Mocha, pytest, unittest, Hypothesis, RSpec |
| **Tooling** | ESLint, Prettier, Biome, Ruff, Black, Flake8, Pylint, mypy |

## CI/CD Integration

### GitHub Actions

```yaml
name: Architecture Analysis
on: [push, pull_request]

jobs:
  architect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for temporal intelligence
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx @girardelli/architect analyze ./src --format html --output architect-report.html
      - run: npx @girardelli/architect score ./src --format json > architect-score.json
      - uses: actions/upload-artifact@v4
        with:
          name: architect-report
          path: |
            architect-report.html
            architect-score.json
```

### As a Dev Dependency

```bash
npm install -D @girardelli/architect
```

```json
{
  "scripts": {
    "architect": "architect analyze ./ --output docs/architect-report.html",
    "architect:score": "architect score ./",
    "architect:agents": "architect agents ./"
  }
}
```

## Programmatic Usage

```typescript
import { Architect, HtmlReportGenerator } from '@girardelli/architect';

const architect = new Architect();

// Full analysis
const report = await architect.analyze('./src');

// Refactoring plan
const plan = architect.refactor(report, './src');

// Agent suggestions (dry-run)
const agents = architect.suggestAgents('./');

// Generate HTML report
const htmlGenerator = new HtmlReportGenerator();
const html = htmlGenerator.generateHtml(report, plan, agents);
```

```typescript
// Temporal intelligence (v5.0)
import { GitHistory, Forecast, TemporalScorer } from '@girardelli/architect/analyzers';

const history = new GitHistory('./');
const commits = await history.analyze();

const scorer = new TemporalScorer();
const trends = scorer.score(commits);

const forecast = new Forecast();
const predictions = forecast.predict(trends);
```

## Development

```bash
npm install
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm test         # Run tests (411 tests, 15 suites)
npm run lint     # ESLint
```

## Roadmap

- **v6.0** — Agent Runtime: orchestrated execution with I/O contracts, pipeline engine, and human approval gates

## Author

**Camilo Girardelli**
IEEE Senior Member | Senior Software Architect | CTO at Girardelli Tecnologia

- GitHub: [@camilooscargbaptista](https://github.com/camilooscargbaptista)
- LinkedIn: [Camilo Girardelli](https://www.linkedin.com/in/camilooscargirardellibaptista/)
- Company: [Girardelli Tecnologia](https://www.girardellitecnologia.com)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - Copyright (c) 2026 Camilo Girardelli / Girardelli Tecnologia

See [LICENSE](LICENSE) for details.
