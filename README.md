# Architect Genesis (v8.0)

<p align="center">
  <img src="assets/cover.png" alt="Architect Holographic Cover Art" width="600" />
</p>

**The First Architecture Intent Compiler & Autonomous Agent Orchestrator**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg)](https://nodejs.org/)
[![npm workspaces](https://img.shields.io/badge/npm-workspaces-orange.svg)](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
[![Tests](https://img.shields.io/badge/Tests-440%20passing-22c55e.svg)]()
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<br/>
<p align="center">
  <img src="assets/demo.gif" alt="Architect CLI Demo" width="800" />
</p>
<br/>

Most AI tools just write code. **Architect Genesis actually reads your architecture.** 

Understand your codebase topology in seconds. Detect severe anti-patterns, generate step-by-step refactoring execution plans, and dispatch **Context-Aware AI Agents** to autonomously fix technical debt without breaking Clean Architecture constraints.

## 🚀 What's New in v8.0.0 (The Genesis Monorepo)

* **Architecture Intent Compiler**: Genesis doesn't just generate text; it compiles your business intent into a declarative `execution-plan.md` mapped strictly against your AST (Abstract Syntax Tree). 
* **NPM Workspaces Ecosystem**: The monolithic `architect` package has been modularized:
  * 🧠 `@girardelli/architect-core`: The headless graph analysis and AST scoring engine.
  * 🤖 `@girardelli/architect-agents`: The autonomous workflows, LLM runtime, and AI Agent generator.
  * ⚡ `@girardelli/architect`: The CLI orchestrator and HTML reporting interface.
* **Autonomous GitHub PR Reports**: The `architect pr-review .` Action automatically drops highly visual architecture scorecards and Refactoring Plans directly inside your Pull Requests!
* **Zero V8 Memory Leaks**: Tree-Sitter components are tightly sealed, pushing past 440 tests structurally clean with complete `composite: true` TypeScript isolation.

## 📦 Quick Start

### 1. Global Installation (CLI)
```bash
npm install -g @girardelli/architect
```

### 2. Run the Analysis
```bash
# Scan the current directory and generate an HTML report
architect analyze .

# Audit and Generate AI Agents tailored for your stack
architect agents .
```

## 🏗️ Core Packages (Monorepo)

Architect is split into specialized packages. Depending on your use case, you can consume the entire CLI or just the core graphing engine for your proprietary SaaS:

| Package | Description | Status |
|---------|-------------|--------|
| [`@girardelli/architect`](packages/architect/) | The command-line interface, Github Actions adapters, and HTML Report generators. | Active |
| [`@girardelli/architect-core`](packages/architect-core/) | Pure graph analysis. AST Parsing, Anti-Pattern detection, and Architecture Scoring (0-100). | Active |
| [`@girardelli/architect-agents`](packages/architect-agents/) | AI Runtime. Maps core reports to autonomous refactoring workflows and custom templates. | Active |

## 🧬 Features

### 1. Universal AST Scanning & Topology
Architect maps your codebase using advanced Tree-Sitter AST across languages (TypeScript, Python, Go, Java, Rust, Ruby, PHP). It understands import semantics, identifies cyclic dependencies, and categorizes layers (View, Core, Data, Infra).

### 2. Anti-Pattern Detection (The Punisher)
Automatically catches architectural sins that humans miss in fast code reviews:
* **God Classes**: Files that know too much and do too much.
* **Leaky Abstractions**: DTOs or DB interfaces crossing into React Components.
* **Shotgun Surgery**: Changes that force edits across 15 different files.
* **Spaghetti Modules**: High O(N²) coupling with no clear interface boundary.

### 3. Context-Aware AI Generation
Architect doesn't spit out generic `agent.md` files. It detects your precise toolchain (e.g., NestJS, Prisma, Jest vs. FastAPI, SQLAlchemy, Pytest). 

It dynamically generates an `.agent/` folder containing:
* **AGENTS**: `ORCHESTRATOR.md`, `BACKEND-DEVELOPER.md`, `TECH-DEBT-CONTROLLER.md`
* **RULES**: Strict boundary rules and OWASP security constraints mapped to your language.
* **WORKFLOWS**: Automated execution plans for `feature`, `bug`, and `refactor`.

### 4. Enterprise Refactoring Engine
Every run produces a tiered Refactoring Plan:
* **Tier 1**: Quick wins (Move variable, rename interface).
* **Tier 2**: Strategic Hub-splits (Break God Class into Facades).

## 📊 The 100-Point Architecture Score
Your project is graded on a strict algorithm measuring:
* **Modularity**: Is the codebase properly separated?
* **Coupling**: How tightly intertwined are the files?
* **Cohesion**: Do the files in a layer actually belong together?
* **Layering**: Does the data flow linearly (UI -> Domain -> DB)?

---

## 🤝 Contributing
We welcome contributions! See the workspaces internally to get started:
```bash
git clone https://github.com/camilooscargbaptista/architect.git
cd architect
npm install
npm run build
npm test
```

## 📜 License
MIT License. Created to put Tech Leads back in control of their scaling repositories.
