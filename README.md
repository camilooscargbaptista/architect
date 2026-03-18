# Architect

**AI-powered architecture analysis tool**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Understand your codebase architecture in seconds. Detect anti-patterns, visualize dependencies, and get actionable refactoring suggestions — all from a single command.

## Overview

Architect performs deep structural analysis of software projects. It generates visual architecture diagrams, calculates quality metrics, and identifies architectural anti-patterns that could indicate technical debt or design problems.

## Features

- **Architecture Quality Score** — 0-100 score with weighted component breakdown (Modularity, Coupling, Cohesion, Layering)
- **Premium HTML Reports** — Dark-themed visual reports with interactive Mermaid diagrams, score gauges, and responsive layout
- **Anti-Pattern Detection**
  - God Class (excessive responsibilities and methods)
  - Circular Dependencies (mutual dependencies creating tight coupling)
  - Leaky Abstractions (internal implementation details exposed publicly)
  - Feature Envy (classes excessively using other class methods)
  - Shotgun Surgery (changes requiring scattered modifications)
- **Layer Detection** — Automatically identifies architectural layers (API, Service, Data, UI, Infrastructure)
- **Framework Detection** — Auto-detects NestJS, React, Angular, Vue.js, Express, Next.js, TypeORM, Prisma, Spring Boot, Django, and more
- **Multi-Language Support** — TypeScript, JavaScript, Python, Java, Go, Ruby, PHP, Rust, SQL, and more
- **Multiple Output Formats** — HTML, JSON, and Markdown
- **NestJS-Aware** — Calibrated thresholds for NestJS module architecture (entities, DTOs, guards, pipes, interceptors)

## Quick Start

```bash
# Run directly with npx (no install needed)
npx @girardelli/architect analyze ./src

# Or install globally
npm install -g @girardelli/architect
architect analyze ./src
```

## CLI Commands

### `architect analyze [path]`
Full architecture analysis with diagram generation, quality scoring, and anti-pattern detection.

```bash
# Generate HTML report (default)
architect analyze ./src

# Generate specific format
architect analyze ./src --format html --output report.html
architect analyze ./src --format json --output report.json
architect analyze ./src --format markdown --output report.md
```

### `architect diagram [path]`
Generate architecture diagram in Mermaid format.

```bash
architect diagram ./src
```

### `architect score [path]`
Calculate architecture quality score with component breakdowns.

```bash
architect score ./src
```

### `architect anti-patterns [path]`
Detect and report anti-patterns with severity levels and remediation suggestions.

```bash
architect anti-patterns ./src
```

### `architect layers [path]`
Analyze layer structure and code distribution across architectural layers.

```bash
architect layers ./src
```

## How It Works

Architect uses a multi-agent pipeline to analyze your codebase:

1. **Scanner** — Traverses project directory, identifies file types, counts lines of code, detects frameworks (including parent `package.json` files), and builds a file tree structure.

2. **Analyzer** — Parses import statements across JavaScript, TypeScript, Python, and Java. Builds a dependency graph and identifies architectural layers (API, Service, Data, UI, Infrastructure) with NestJS-aware heuristics.

3. **Anti-Pattern Detector** — Scans for God Classes, Circular Dependencies, Leaky Abstractions, Feature Envy, and Shotgun Surgery with configurable thresholds calibrated for modern frameworks.

4. **Scorer** — Evaluates architecture quality across four dimensions:
   - **Modularity (40%)** — Appropriate module boundaries and cohesion
   - **Coupling (25%)** — Dependencies between modules minimized
   - **Cohesion (20%)** — Related functionality grouped together
   - **Layering Compliance (15%)** — Proper separation of concerns

5. **Reporter** — Generates comprehensive reports in HTML, Markdown, or JSON with diagrams, scores, findings, and suggestions.

## Configuration

Create a `.architect.json` file in your project root to customize analysis:

```json
{
  "ignore": [
    "node_modules",
    "dist",
    ".git",
    "coverage"
  ],
  "frameworks": {
    "detect": true
  },
  "antiPatterns": {
    "godClass": {
      "linesThreshold": 500,
      "methodsThreshold": 10
    },
    "shotgunSurgery": {
      "changePropagationThreshold": 8
    }
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

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "architect": "architect analyze ./src --format html --output docs/architect-report.html",
    "architect:json": "architect analyze ./src --format json --output docs/architect-report.json"
  }
}
```

## Programmatic Usage

```typescript
import { architect, HtmlReportGenerator } from '@girardelli/architect';

const report = await architect.analyze('./src');

console.log(`Score: ${report.score.overall}/100`);
console.log(`Anti-patterns: ${report.antiPatterns.length}`);
console.log(`Frameworks: ${report.projectInfo.frameworks.join(', ')}`);

// Generate HTML
const htmlGenerator = new HtmlReportGenerator();
const html = htmlGenerator.generateHtml(report);
```

## Output Example

```
🏗️  Architect — Architecture Analysis
📂 Path: /path/to/project/src
📋 Command: analyze
📄 Format: html

✅ HTML report saved to: architect-report.html
📊 Score: 59/100

═══════════════════════════════════════
  SCORE: 59/100
═══════════════════════════════════════
├─ Modularity: 70
├─ Coupling:   85
├─ Cohesion:   30
└─ Layering:   25

📁 Files: 1125 | 📝 Lines: 195,709
⚠️  Anti-patterns: 463
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

## Installation

```bash
npm install
npm run build
npm test
```

## Development

```bash
npm run build    # Compile TypeScript
npm run dev      # Watch mode
npm test         # Run tests
npm run lint     # ESLint
```

## Author

**Camilo Girardelli**
IEEE Senior Member | Senior Software Architect | CTO at Girardelli Tecnologia

- GitHub: [@camilogivago](https://github.com/camilogivago)
- LinkedIn: [Camilo Girardelli](https://www.linkedin.com/in/camilo-girardelli/)
- Company: [Girardelli Tecnologia](https://girardelli.tech)

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - Copyright (c) 2026 Camilo Girardelli / Girardelli Tecnologia

See [LICENSE](LICENSE) for details.

---

**Architect** — Making software architecture analysis accessible to every developer.
