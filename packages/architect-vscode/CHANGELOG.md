# Changelog

## 9.0.0 (2026-04-02)

### New Features
- **Score Diagnostics** — Anti-patterns and refactoring suggestions shown as inline diagnostics (errors, warnings, hints) in the editor
- **Code Lens** — Hub files (high fan-in) display "Hub File — N dependents" with "Split this hub" action directly in the editor
- **Forecast Overlay** — At-risk files get background color decorations (red/orange/yellow) with hover cards showing score predictions
- **Genesis Context Menu** — Right-click any file to generate a targeted refactoring prompt
- **Status Bar** — Live architecture score with contextual icon (pass/warning/error) and full breakdown tooltip
- **Anti-Pattern Navigator** — Quick Pick with all detected anti-patterns, click to navigate to affected file
- **Plugin Management** — `Architect: List Plugins` command for marketplace integration

### Commands
- `Architect: Analyze Architecture` — Full analysis with diagnostics, code lens, and status bar update
- `Architect: Interactive Refactoring` — Opens interactive step-by-step refactoring terminal
- `Architect: Forecast Score Decay` — ML-based prediction with visual risk overlays
- `Architect: Open Genesis Terminal` — Interactive Genesis TUI
- `Architect: Generate Refactoring Prompt for This File` — Context menu integration
- `Architect: Show Anti-Patterns` — Navigable anti-pattern list
- `Architect: List Plugins` — Show installed Architect plugins
- `Architect: Split Hub File` — Triggered from Code Lens on hub files

### Settings
- `architect.autoAnalyzeOnOpen` — Auto-analyze on workspace open (default: false)
- `architect.analyzeOnSave` — Re-analyze on file save (default: false)
- `architect.hubThreshold` — Minimum dependents to flag a hub file (default: 5)

## 8.1.0 (2026-03-31)

### Initial Release
- Basic `Architect: Analyze Security & Patterns` command
- Basic `Architect: Generate Refactoring Plan` command (Genesis terminal)
