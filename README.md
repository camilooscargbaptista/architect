# Architect

**AI-powered architecture analysis, refactoring, and agent system generator**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/npm/v/@girardelli/architect)](https://www.npmjs.com/package/@girardelli/architect)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Understand your codebase architecture in seconds. Detect anti-patterns, get refactoring plans, and generate AI agent configurations — all from a single command.

## What's New in v2.1

- 🔧 **Unified `analyze` command** — Architecture analysis + refactoring plan + agent system suggestions in one report
- 🤖 **AI Agent System Generator** — Suggests agents, rules, guards, workflows, and skills based on detected stack
- 🧠 **Skills from [skills.sh](https://skills.sh)** — Stack-specific skill recommendations with install commands
- 🎯 **Interactive UI** — Toggle cards with Select All/None, dynamic command builder, and copy-to-clipboard
- 📊 **Refactoring Plan** — Tier-based refactoring steps with score impact predictions

## Quick Start

```bash
# Run directly with npx (no install needed)
npx @girardelli/architect analyze ./src

# Or install globally
npm install -g @girardelli/architect
architect analyze ./src
```

## Features

### 📊 Architecture Analysis
- **Quality Score** — 0-100 score with weighted breakdown (Modularity, Coupling, Cohesion, Layering)
- **Anti-Pattern Detection** — God Class, Circular Dependencies, Leaky Abstractions, Feature Envy, Shotgun Surgery
- **Layer Detection** — Automatically identifies API, Service, Data, UI, and Infrastructure layers
- **Dependency Graph** — Interactive D3.js force-directed graph visualization
- **Framework Detection** — NestJS, React, Angular, Vue, Next.js, Express, Django, Flask, Spring Boot, and more
- **Multi-Language** — TypeScript, JavaScript, Python, Java, Go, Ruby, PHP, Rust, SQL

### 🔧 Refactoring Plan
- **Tier 1 (Quick Wins)** — Low-risk improvements for immediate impact
- **Tier 2 (Strategic)** — Larger refactoring with architecture-level benefits
- **Score Impact** — Before/after predictions for each refactoring step
- **File Operations** — CREATE, MOVE, MODIFY, DELETE with detailed descriptions

### 🤖 AI Agent System
- **Stack Detection** — Identifies languages, frameworks, backend/frontend/mobile/database
- **Agent Suggestions** — Orchestrator, Backend Developer, Frontend Developer, Database Engineer, Security Auditor, QA, Tech Debt Controller
- **Rules & Guards** — Architecture rules, security rules, preflight checks, quality gates
- **Workflows** — Development, bug-fix, code review workflows
- **Skills** — [skills.sh](https://skills.sh) recommendations mapped to your stack (TDD, debugging, security, performance, etc.)
- **Audit Mode** — If `.agent/` exists, audits and suggests improvements
- **Interactive UI** — Toggle cards for selecting which items to generate
- **Command Builder** — Dynamic CLI command updates based on selection

### 📄 Premium HTML Report
- Dark-themed responsive design with Inter font
- Animated score gauge with gradient
- Interactive D3.js dependency graph
- Bubble chart for anti-pattern severity
- Collapsible refactoring steps with code previews
- Toggle cards for agent system selection
- Single self-contained HTML file (no external dependencies)

## CLI Commands

### `architect analyze [path]`
**The unified command** — runs architecture analysis, refactoring plan, and agent suggestions.

```bash
# Full analysis with HTML report (default)
architect analyze ./src

# Custom output path
architect analyze ./src --output docs/report.html

# JSON or Markdown output
architect analyze ./src --format json --output report.json
architect analyze ./src --format markdown --output report.md
```

### `architect refactor [path]`
Generate a standalone refactoring plan.

```bash
architect refactor ./src --output refactor-plan.html
```

### `architect agents [path]`
Generate or audit the `.agent/` directory for AI coding assistants.

```bash
# Generate agent configuration files
architect agents ./

# With specific selections
architect agents ./ --agents ORCHESTRATOR,QA-TEST-ENGINEER --rules 00-general,01-architecture
```

### `architect diagram [path]`
Generate architecture diagram in Mermaid format.

### `architect score [path]`
Calculate architecture quality score.

### `architect anti-patterns [path]`
Detect anti-patterns with severity levels.

### `architect layers [path]`
Analyze layer structure and distribution.

## Output Example

```
🏗️  Architect — Architecture Analysis
📂 Path: /path/to/project/src
📋 Command: analyze
📄 Format: html

✅ HTML report saved to: architect-report.html
📊 Score: 82/100
⚠️  Anti-patterns: 1
🔧 Refactoring steps: 2
🤖 Suggested agents: 6

═══════════════════════════════════════
  SCORE: 82/100
═══════════════════════════════════════
├─ Modularity: 95
├─ Coupling:   50
├─ Cohesion:   95
└─ Layering:   85

📁 Files: 12 | 📝 Lines: 1,521
⚠️  Anti-patterns: 1
🤖 Agents: 6 suggested | No .agent/ found
```

## Configuration

Create `.architect.json` in your project root:

```json
{
  "ignore": ["node_modules", "dist", ".git", "coverage"],
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
    "architect:json": "architect analyze ./src --format json --output docs/report.json"
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

// Agent suggestions (dry-run, no files created)
const agents = architect.suggestAgents('./');

// Generate unified HTML report
const htmlGenerator = new HtmlReportGenerator();
const html = htmlGenerator.generateHtml(report, plan, agents);
```

## Supported Frameworks

| Framework | Detection Method |
|-----------|-----------------|
| NestJS | `@nestjs/core` in dependencies |
| React | `react` in dependencies |
| Angular | `@angular/core` in dependencies |
| Vue.js | `vue` in dependencies |
| Next.js | `next` in dependencies |
| Express.js | `express` in dependencies |
| TypeORM | `typeorm` in dependencies |
| Prisma | `@prisma/client` in dependencies |
| Spring Boot | `spring-boot` in pom.xml |
| Django | `django` in requirements.txt |
| Flask | `flask` in requirements.txt |
| Flutter | `flutter` in pubspec.yaml |

## Development

```bash
npm install
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm test         # Run tests
npm run lint     # ESLint
```

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

---

**Architect** — Architecture analysis, refactoring plans, and AI agent generation for every developer.
