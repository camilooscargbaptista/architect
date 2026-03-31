# Feature: Enterprise Custom Rules Engine & SDK (Phase 2.3)

## 🎯 Objective
Introduce the Plugin SDK to Architect, enabling dynamic extensibility for enterprise-level custom architectural rules.

## 🏗️ Technical Context
While Architect provides powerful generic heuristics (like God Class and Circular Dependencies), strict enterprise environments often dictate bespoke domain boundaries. We needed a robust, non-blocking way to allow developers to write custom AST hooks in standard ESM/CJS JavaScript, and have them execute seamlessly alongside native detectors during the Analysis flow. 

## 🔧 Solution Implementation
- **Dynamic Plugin Loader:** Implemented `PluginLoader` utilizing `await import()` specifically to bypass ESM limits without polluting parallel memory pools (learned from the Tree-Sitter GC issue in Phase 2.2).
- **Asynchronous Execution Pipeline:** Upgraded `AntiPatternDetector`'s `detect()` flow from structural array mapping to `async/await` Promises.
- **Fail-Safe Mechanism:** Deep-try/catch blocks shield the native pipeline so a client's flawed external plugin script doesn't crash the global CI process.
- **`ArchitectConfig` Extension:** Seamless configuration via the `.architect.json` `plugins: []` array.

## 🎨 Walkthrough & Examples
- Included `examples/my-enterprise-rule.mjs` showcasing a real-world AcmeCorp use case: blocking `src/domain` from importing `src/infrastructure` and preventing Controller-to-Controller coupling.
- Updated `README.md` to document the Extension API and Configuration blocks.

## ✅ Quality Checks
- `[x]` E2E Native Flow untouched
- `[x]` 438 internal tests passing
- `[x]` PluginLoader Unit Tests isolated and verified
- `[x]` No C++ Memory Leaks regression
