# Phase 0 Critical Bugs - Complete List

> **Status:** BLOCKING v8.2 release
> **Severity:** CRITICAL (6/6 bugs invalidate Genesis output)
> **Document:** Generated 2026-04-04

This document lists all 6 Phase 0 critical bugs identified in EVOLUTION_PLAN.md. **v8.1.0 ships with these bugs unfixed.** Users may spend hours analyzing codebases only to receive false positives.

---

## Overview

| Bug | Title | File | Severity | Est. Fix |
|-----|-------|------|----------|----------|
| 0.1 | Standard Library Filter | hub-splitter.ts | 🔴 CRITICAL | 4h |
| 0.2 | Language-Aware Extension Map | hub-splitter.ts | 🔴 CRITICAL | 2h |
| 0.3 | Prompt Size Control | offline-prompt-generator.ts | 🟠 HIGH | 6h |
| 0.4 | Module Grouper Filter | module-grouper.ts | 🔴 CRITICAL | 2h |
| 0.5 | Import Organizer Filter | import-organizer.ts | 🔴 CRITICAL | 2h |
| 0.6 | Consumer Follow-up Block | offline-prompt-generator.ts | 🟠 HIGH | 3h |

**Total Estimated Fix Time:** 19 hours

---

## Bug 0.1: Standard Library Filter

**Severity:** 🔴 CRITICAL

**Problem:**
`isDotNotation` in `hub-splitter.ts:46` incorrectly classifies Node.js builtins (`fs`, `path`, `crypto`) as internal modules. Genesis attempts to refactor the Node runtime.

**Reproduction:**
```bash
npx architect analyze . --json | grep '"fs"'
# Should return 0 results (fs should be filtered)
```

**Solution:**
1. Create `packages/architect-core/src/core/utils/stdlib-registry.ts`
2. Implement `StandardLibraryRegistry` for all 6 languages (TS, JS, Python, Go, Rust, Java)
3. Implement `isExternalDependency(importPath, language, projectFiles): boolean`
4. Update hub-splitter.ts to use this function

**Reference:** EVOLUTION_PLAN.md, Fix 0.1 (lines 29-175)

---

## Bug 0.2: Language-Aware Extension Map

**Severity:** 🔴 CRITICAL

**Problem:**
Line 53 hardcodes `.py` fallback, generating Python filenames in TypeScript projects.

**Reproduction:**
```bash
npx architect refactor . --dry-run | grep '.py'
# Should return 0 results in TypeScript project (should be .ts)
```

**Solution:**
1. Create `packages/architect-core/src/core/utils/language-utils.ts`
2. Implement `EXTENSION_MAP`, `COMMENT_SYNTAX`, `BARREL_FILENAMES` lookup tables
3. Export: `getExtension(language)`, `getCommentSyntax(language)`, `getBarrelFilenames(language)`
4. Update hub-splitter.ts and import-organizer.ts to use these functions

**Reference:** EVOLUTION_PLAN.md, Fix 0.2 (lines 176-241)

---

## Bug 0.3: Prompt Size Control

**Severity:** 🟠 HIGH

**Problem:**
Inlines ALL files without size limit. Generates 500KB+ prompts with 52 files, unusable in chat UI.

**Reproduction:**
```bash
npx architect refactor . --output-prompts /tmp/test/
wc -c /tmp/test/*.md
# Large prompt files (>120KB / 30K tokens)
```

**Solution:**
1. Create `packages/architect-agents/src/core/agent-runtime/prompt-budget.ts`
2. Implement `PromptBudgetConfig` with token limits
3. Implement operation prioritization: `core-target` > `important-context` > `consumer-ref`
4. Implement `abbreviateFileContent()` for overflow files
5. Update offline-prompt-generator.ts to respect budget

**Reference:** EVOLUTION_PLAN.md, Fix 0.3 (lines 244-403)

---

## Bug 0.4: Module Grouper External Filter

**Severity:** 🔴 CRITICAL

**Problem:**
Builds co-import matrix using ALL edges including stdlib/vendor. Generates steps attempting to move `fs` and `path` to `shared/`.

**Solution:**
1. Apply `isExternalDependency()` filter from Bug 0.1
2. Filter graph edges BEFORE building co-import matrix
3. Use only internal edges in module grouper logic

**Reference:** EVOLUTION_PLAN.md, Fix 0.4 (lines 406-431)

---

## Bug 0.5: Import Organizer External Filter

**Severity:** 🔴 CRITICAL

**Problem:**
Generates facades aggregating external deps. Creates useless barrels:
```typescript
// src/core/architect_deps.ts (WRONG)
export { readFileSync } from 'fs';      // ← absurd
export { join, resolve } from 'path';   // ← absurd
```

**Also:** Same `.py` hardcode bug as Bug 0.2.

**Solution:**
1. Apply `isExternalDependency()` filter before generating facades
2. Use `getExtension()` and `getCommentSyntax()` from language-utils.ts

**Reference:** EVOLUTION_PLAN.md, Fix 0.5 (lines 434-462)

---

## Bug 0.6: Consumer Follow-up Block

**Severity:** 🟠 HIGH

**Problem:**
Genesis generates splits without informing LLM which consumers need manual updates. LLM is blind to cascading impact.

**Reproduction:**
```bash
npx architect refactor . --output-prompts /tmp/test/
grep -l "Manual Follow-up" /tmp/test/*.md
# Should have follow-up block when MODIFY operations exist
```

**Solution:**
1. After each step, generate explicit follow-up block
2. List all `consumer-ref` MODIFY operations
3. Include concrete file paths and descriptions

**Reference:** EVOLUTION_PLAN.md, Fix 0.6 (lines 466-516)

---

## Validation Checklist

After implementing all 6 fixes, run self-test:

```bash
npx architect analyze . --json > /tmp/self-analysis.json
npx architect refactor . --dry-run --output-prompts /tmp/genesis-test/

# Validation
grep -r "require('fs')\|from 'fs'\|from 'path'" /tmp/genesis-test/
# Must return 0 results

wc -c /tmp/genesis-test/*.md
# No file should exceed ~120KB (30K tokens × 4 chars)
```

**Before Release Checklist:**
- [ ] No step mentions `fs`, `path`, `crypto`, `os`, or stdlib
- [ ] All generated extensions correct (`.ts` for TS, `.py` for Python)
- [ ] No prompt exceeds 30K tokens
- [ ] Follow-up block present when consumers exist
- [ ] Module Grouper doesn't attempt to move stdlib modules

---

## Impact on Users

**Current behavior (v8.1.0):**
- Genesis flags Node stdlib modules as refactoring candidates
- Generates prompts that exceed chat UI limits (500KB+)
- LLM receives no information about cascading impacts

**After fixes:**
- Only actual architectural issues detected
- Prompts fit within UI (30K token budget)
- Full transparency about consumer impacts

---

## Tracking

- EVOLUTION_PLAN.md (lines 24-516)
- CTO Technical Assessment: v8.1.0 Score 7.2/10
- Action Plan Task 1.1: Documentar & Priorizar Phase 0 Bugs

---

**Status:** Blocked v8.2 release until fixes implemented. Recommend marketing as experimental until Phase 0 complete.
