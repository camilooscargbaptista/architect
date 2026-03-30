# Architect

<p align="center">
  <img src="assets/cover.png" alt="Architect Holographic Cover Art" width="600" />
</p>
**AI-powered architecture analysis, refactoring, and context-aware agent system generator**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/@girardelli/architect)](https://www.npmjs.com/package/@girardelli/architect)
[![Tests](https://img.shields.io/badge/Tests-337%20passing-22c55e.svg)]()
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<br/>
<p align="center">
  <img src="assets/demo.gif" alt="Architect CLI Demo" width="800" />
</p>
<br/>

Understand your codebase architecture in seconds. Detect anti-patterns, get refactoring plans, and generate **context-aware AI agent configurations** that actually understand your stack, domain, and toolchain — all from a single command.

## What's New in v6.0.0

- **Strict Layered Architecture** — Internal codebase rebuilt utilizing a rigorous Core/Infrastructure/Adapters clean architecture format, verifiable dynamically leading to a perfect 100/100 Layering score.
- **Self-Healing AI Engine** — Architecture rules (Hub Splitter, Import Organizer, Module Grouper) are now context-aware of Clean Architecture paradigms, effectively ignoring stable DTOs/Interfaces and cross-domain test injections to eliminate false positives.
- **AST Automation Proven** — Capable of structurally rewriting 150+ coupling bottlenecks in large codebases automatically via AST manipulation and Facade (`_deps.ts`) extractions.

- **Context-Aware Agent Generation** — Agents are no longer generic. Templates adapt to your detected stack (Python/FastAPI generates pytest examples, not Jest; Go generates `go test`, not `npm test`)
- **Framework Detection Engine** — 61 frameworks across 10+ ecosystems detected from dependency files (package.json, pyproject.toml, requirements.txt, pubspec.yaml, go.mod, Cargo.toml, pom.xml, Gemfile, composer.json)
- **Domain Inference** — Detects business domain (fintech, healthtech, e-commerce, tax, HR, etc.) from project metadata, README, and code structure. Generates domain-specific BDD scenarios, threat models, and compliance requirements (LGPD, PCI-DSS, HIPAA, SOX)
- **Stack-Aware Templates** — C4 Level 4 code blocks, TDD test examples, ADR decisions, quality gates, and forbidden actions all adapt to the detected language and framework
- **Skills Generator** — Detects architectural patterns in your codebase (adapters, factories, extractors, repositories) and generates `skills/PROJECT-PATTERNS.md`
- **Enriched Context** — Module extraction, endpoint detection, toolchain commands, project structure analysis, and critical path identification feed into every generated template
- **Premium HTML Report** — Dark-themed responsive report with interactive D3.js dependency graph, health radar, bubble charts, and collapsible refactoring steps

## Quick Start

```bash
# Run directly with npx (no install needed)
npx @girardelli/architect analyze ./src

# Or install globally
npm install -g @girardelli/architect
architect analyze ./src
```

## Core Features

### Architecture Analysis

Architect scans your codebase and produces a quality score (0-100) with weighted breakdown across four dimensions: Modularity, Coupling, Cohesion, and Layering. It detects anti-patterns (God Class, Circular Dependencies, Leaky Abstractions, Feature Envy, Shotgun Surgery) with severity levels and specific file locations, and automatically identifies architectural layers (API, Service, Data, UI, Infrastructure).

The analysis supports TypeScript, JavaScript, Python, Java, Kotlin, Go, Ruby, PHP, Rust, Dart, and SQL. Framework detection covers 61 frameworks across all major ecosystems — from NestJS and React to FastAPI, Spring Boot, Flutter, Gin, Actix Web, and Rails.

### Refactoring Plan

Each analysis produces a tiered refactoring plan with score impact predictions. Tier 1 contains quick wins (low-risk, immediate impact), Tier 2 covers strategic refactoring with architecture-level benefits. Every step includes before/after score predictions and specific file operations (CREATE, MOVE, MODIFY, DELETE).

### Context-Aware Agent System

This is what sets Architect apart. The `.agent/` directory it generates isn't a generic template — it's deeply customized to your project.

**What gets generated (20+ files):**

```
.agent/
├── INDEX.md                          # Project overview with badges and links
├── agents/
│   ├── AGENT-ORCHESTRATOR.md         # 5-phase protocol, dispatch table, quality gates
│   ├── {STACK}-BACKEND-DEVELOPER.md  # Stack-specific backend agent
│   ├── {FRAMEWORK}-FRONTEND-DEVELOPER.md
│   ├── FLUTTER-UI-DEVELOPER.md       # (if mobile detected)
│   ├── DATABASE-ENGINEER.md          # (if database detected)
│   ├── SECURITY-AUDITOR.md           # STRIDE threats, compliance, integrations
│   ├── QA-TEST-ENGINEER.md           # Coverage tracking, test scenarios
│   └── TECH-DEBT-CONTROLLER.md       # Score targets, anti-pattern tracking
├── rules/
│   ├── 00-general.md                 # Golden rules, naming, forbidden actions (stack-aware)
│   ├── 01-architecture.md            # Anti-pattern prevention, module structure
│   ├── 02-security.md                # OWASP, secrets, input validation
│   └── {stack}-rules.md              # Stack-specific rules (Python, TypeScript, etc.)
├── guards/
│   ├── PREFLIGHT.md                  # Pre-action checklist with detected toolchain
│   ├── QUALITY-GATES.md              # Build/test/coverage/score gates
│   └── CODE-REVIEW-CHECKLIST.md      # Domain-specific review items
├── workflows/
│   ├── new-feature.md                # Feature development workflow
│   ├── fix-bug.md                    # Bug fix workflow
│   └── review.md                     # Code review workflow
├── templates/
│   ├── C4.md                         # Architecture template (framework-aware Level 4)
│   ├── BDD.md                        # BDD scenarios (domain-aware)
│   ├── TDD.md                        # TDD examples (pytest/junit/go_test/jest per stack)
│   ├── ADR.md                        # Decision records (stack-aware context)
│   └── THREAT-MODEL.md               # STRIDE model (domain-specific threats)
└── skills/
    └── PROJECT-PATTERNS.md           # Detected patterns (adapters, factories, etc.)
```

**What makes it context-aware:**

A Python/FastAPI project gets pytest examples in TDD, `class ABC` interfaces in C4, SQLAlchemy references in ADR, `type: ignore` in forbidden actions, and `pytest` in quality gates. A TypeScript/NestJS project gets Jest, `interface`, TypeORM/Prisma, `@ts-ignore`, and `npm run build`. A Go project gets `go test`, `type ... interface`, GORM, `interface{}` warnings, and `go build`. The same command produces fundamentally different output based on what it detects.

**Domain inference feeds into every template.** A fintech project gets PCI-DSS compliance gates, fraud-prevention BDD scenarios, and encryption-focused threat models. A healthtech project gets HIPAA checks and patient data protection rules. Domain confidence is boosted by reading pyproject.toml descriptions, README keywords, and project names.

## CLI Commands

### `architect analyze [path]`
The unified command — architecture analysis, refactoring plan, and agent suggestions in one report.

```bash
architect analyze ./src                              # HTML report (default)
architect analyze ./src --output docs/report.html    # Custom path
architect analyze ./src --format json                # JSON output
architect analyze ./src --format markdown             # Markdown output
```

### `architect agents [path]`
Generate or audit the `.agent/` directory for AI coding assistants.

```bash
architect agents ./                                  # Generate full .agent/
architect agents ./ --agents ORCHESTRATOR,QA          # Specific agents only
```

If `.agent/` already exists, Architect audits it and only generates missing files.

### `architect refactor [path]`
Generate a standalone refactoring plan.

### `architect score [path]`
Calculate architecture quality score (quick mode).

### `architect anti-patterns [path]`
Detect anti-patterns with severity levels.

### `architect layers [path]`
Analyze layer structure and distribution.

### `architect diagram [path]`
Generate architecture diagram in Mermaid format.

## Configuration

Create `.architect.json` in your project root:

```json
{
  "ignore": ["node_modules", "dist", ".git", "coverage", "__pycache__", ".venv"],
  "frameworks": { "detect": true },
  "antiPatterns": {
    "godClass": { "linesThreshold": 500, "methodsThreshold": 10 },
    "shotgunSurgery": { "changePropagationThreshold": 20 }
  },
  "score": {
    "modularity": 0.40,
    "coupling": 0.25,
    "cohesion": 0.20,
    "layering": 0.15
  }
}
```

## Supported Frameworks (61)

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
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx @girardelli/architect analyze ./src --format html --output architect-report.html
      - uses: actions/upload-artifact@v4
        with:
          name: architect-report
          path: architect-report.html
```

### As a Dev Dependency

```bash
npm install -D @girardelli/architect
```

```json
{
  "scripts": {
    "architect": "architect analyze ./src --output docs/architect-report.html",
    "architect:score": "architect score ./src"
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

## Development

```bash
npm install
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm test         # Run tests (337 tests, 9 suites)
npm run lint     # ESLint
```

## Roadmap

- **v4.0** — Agent Runtime: orchestrated execution with I/O contracts, pipeline engine, and human approval gates

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
