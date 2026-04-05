# Architect Intelligence

Enterprise architecture analysis directly in your editor. Detect anti-patterns, track score decay, get AI-powered refactoring suggestions — all without leaving VS Code.

## Features

### Architecture Score & Diagnostics

Run **Architect: Analyze Architecture** to get a full health check of your codebase. Anti-patterns appear as inline diagnostics (errors, warnings, hints) in the Problems panel and directly on affected files.

The status bar shows your live architecture score with a color-coded icon:
- **Green** (80+) — Healthy architecture
- **Yellow** (60-79) — Needs attention
- **Red** (<60) — Severe issues detected

### Hub Detection (Code Lens)

Files with high fan-in (many dependents) are automatically flagged with Code Lens annotations:

```
◉ Hub File — 12 dependents
⫸ Split this hub
```

Click "Split this hub" to start an interactive refactoring session that decomposes the hub into focused modules.

### Forecast Overlay

Run **Architect: Forecast Score Decay** to predict where your architecture is heading. At-risk files get visual overlays:

- **Red background** — Critical risk (score dropping fast)
- **Orange background** — High risk
- **Yellow background** — Medium risk

Hover over the annotation to see predicted scores and weekly decay rate.

### Genesis Refactoring Prompts

Right-click any file → **Architect: Generate Refactoring Prompt for This File** to get a targeted, AI-ready prompt with specific refactoring steps for that file. Use it with Claude, GPT, or any LLM to execute the refactoring.

### Interactive Refactoring

Run **Architect: Interactive Refactoring** to open a step-by-step terminal session that walks you through each refactoring step with previews, approvals, and automatic re-analysis after each change.

## Commands

| Command | Description |
|---------|-------------|
| `Architect: Analyze Architecture` | Full analysis with diagnostics, code lens, and status bar |
| `Architect: Interactive Refactoring` | Step-by-step guided refactoring in terminal |
| `Architect: Forecast Score Decay` | ML-based prediction with visual risk overlays |
| `Architect: Open Genesis Terminal` | Interactive Genesis TUI for advanced refactoring |
| `Architect: Generate Refactoring Prompt` | Right-click context menu — AI-ready prompt for a file |
| `Architect: Show Anti-Patterns` | Navigable list of all detected anti-patterns |
| `Architect: List Plugins` | Show installed Architect plugins |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `architect.autoAnalyzeOnOpen` | `false` | Auto-analyze when opening a workspace |
| `architect.analyzeOnSave` | `false` | Re-analyze on every file save |
| `architect.hubThreshold` | `5` | Minimum dependents to flag a file as a Hub |

## Supported Languages

TypeScript, JavaScript, Python, Go, Rust, Java.

## Requirements

The extension uses the Architect CLI under the hood. It is automatically installed via `npx` on first use — no manual setup required.

For the best experience, install the CLI globally:

```bash
npm install -g @girardelli/architect
```

## About

Built by [Girardelli Tecnologia](https://github.com/camilooscargbaptista). Architecture analysis powered by AST parsing, dependency graph analysis, and ML-based forecasting.

**License:** MIT
