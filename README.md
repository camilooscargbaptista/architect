# Architect

**AI-powered architecture analysis for Claude Code**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Claude Code Plugin](https://img.shields.io/badge/Claude%20Code-Plugin-blueviolet.svg)](https://github.com/anthropics/claude-code)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Understand your codebase architecture in seconds. Detect anti-patterns, visualize dependencies, and get actionable refactoring suggestions — all from Claude Code.

## Overview

Architect is a Claude Code plugin that performs deep structural analysis of software projects. It generates visual architecture diagrams, calculates quality metrics, and identifies architectural anti-patterns that could indicate technical debt or design problems.

## Features

- **Architecture Diagram Generation** - Mermaid diagrams showing components, layers, and dependencies
- **Dependency Graph Analysis** - Visualize how modules and services interact
- **Anti-Pattern Detection**
  - God Class (excessive responsibilities and methods)
  - Circular Dependencies (mutual dependencies creating tight coupling)
  - Leaky Abstractions (internal implementation details exposed publicly)
  - Feature Envy (classes excessively using other class methods)
  - Shotgun Surgery (changes requiring scattered modifications)
- **Architecture Quality Score** - 0-100 score with weighted component breakdown
- **Layer Detection** - Automatically identifies architectural layers (API, Service, Data, UI, Infrastructure)
- **Refactoring Suggestions** - Prioritized, actionable recommendations
- **Multiple Export Formats** - Mermaid, JSON, and Markdown

## Quick Start

```bash
claude install @girardelli/architect
claude architect analyze /path/to/project
```

## Commands

### `architect analyze [path]`
Performs complete architecture analysis including diagram generation, quality scoring, and anti-pattern detection.

```bash
claude architect analyze ./src
```

### `architect diagram [path]`
Generates architecture diagram in Mermaid format without full analysis.

```bash
claude architect diagram ./
```

### `architect score [path]`
Calculates architecture quality score only, showing component breakdowns.

```bash
claude architect score ./src
```

### `architect anti-patterns [path]`
Detects and reports anti-patterns with severity levels and remediation suggestions.

```bash
claude architect anti-patterns ./
```

### `architect layers [path]`
Analyzes layer structure and shows distribution of code across architectural layers.

```bash
claude architect layers ./src
```

## How It Works

Architect uses a 4-agent pipeline to analyze your codebase:

1. **Scanner Agent** - Traverses project directory, identifies file types, counts lines of code, detects framework signatures, and builds a file tree structure.

2. **Analyzer Agent** - Parses import statements across JavaScript, TypeScript, Python, and Java. Builds a dependency graph and identifies architectural layers (API, Service, Data, UI, Infrastructure).

3. **Scorer Agent** - Evaluates architecture quality across four dimensions:
   - **Modularity (40%)** - Appropriate module boundaries and cohesion
   - **Coupling (25%)** - Dependencies between modules minimized
   - **Cohesion (20%)** - Related functionality grouped together
   - **Layering Compliance (15%)** - Proper separation of concerns

4. **Reporter Agent** - Generates comprehensive markdown reports with diagrams, scores, findings, and suggestions.

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
      "changePropagationThreshold": 5
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

## Output Example

```
ARCHITECT ANALYSIS REPORT
=========================

Architecture Quality Score: 72/100
├─ Modularity: 78/100
├─ Coupling: 65/100
├─ Cohesion: 72/100
└─ Layering: 68/100

Files Scanned: 147
Lines of Code: 24,583
Frameworks Detected: React, Express.js

ANTI-PATTERNS DETECTED (3)
──────────────────────────
✗ God Class - src/services/UserManager.ts (CRITICAL)
  Lines: 834 | Methods: 16 | Suggestions: 2

✗ Circular Dependency - src/utils ↔ src/services (HIGH)
  Path: auth.ts → cache.ts → auth.ts

◆ Leaky Abstraction - src/models/Database.ts (MEDIUM)
  Exports 12 internal types publicly

REFACTORING SUGGESTIONS
───────────────────────
1. (CRITICAL) Split UserManager into Repository, Service, and Manager
2. (HIGH) Break circular dependency between auth and cache modules
3. (MEDIUM) Hide internal database types behind facade pattern
```

## Screenshot

[Example architecture diagram showing a microservices application with components, layers, and dependencies visualized in a clean hierarchical structure]

## Installation

```bash
npm install
npm run build
npm test
```

## Development

Build the project:
```bash
npm run build
```

Run tests:
```bash
npm test
```

Watch mode:
```bash
npm run dev
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

## Support

Found a bug or have a feature request? Open an issue on GitHub.

Have questions? Reach out to the author or the community.

---

**Architect** - Making software architecture analysis accessible to every developer.
