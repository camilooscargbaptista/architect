# GitHub Issue Template - Phase 0 Critical Bugs

> **Como usar este arquivo:**
> 1. Abra https://github.com/camilooscargbaptista/architect/issues/new
> 2. Copie o conteúdo completo abaixo (após "---")
> 3. Cole na seção de descrição do issue
> 4. Ajuste o título conforme necessário
> 5. Clique em "Submit new issue"

---

# Issue Title

```
Phase 0 Critical Bugs - Complete List [BLOCKING v8.2]
```

---

# Issue Description (copiar tudo abaixo)

> **Status:** BLOCKING v8.2 release
> **Severity:** CRITICAL (6/6 bugs invalidate Genesis output)
> **Document:** See [PHASE_0_CRITICAL_BUGS.md](./PHASE_0_CRITICAL_BUGS.md)

This issue documents all 6 Phase 0 critical bugs identified in EVOLUTION_PLAN.md. **v8.1.0 ships with these bugs unfixed.** Users may spend hours analyzing codebases only to receive false positives.

See detailed documentation in [PHASE_0_CRITICAL_BUGS.md](./PHASE_0_CRITICAL_BUGS.md) for complete bug descriptions, reproduction steps, and solutions.

## Overview

| Bug | Title | File | Impact | Est. Fix |
|-----|-------|------|--------|----------|
| 0.1 | Standard Library Filter | hub-splitter.ts | CRITICAL | 4h |
| 0.2 | Language-Aware Extension Map | hub-splitter.ts | CRITICAL | 2h |
| 0.3 | Prompt Size Control | offline-prompt-generator.ts | HIGH | 6h |
| 0.4 | Module Grouper Filter | module-grouper.ts | CRITICAL | 2h |
| 0.5 | Import Organizer Filter | import-organizer.ts | CRITICAL | 2h |
| 0.6 | Consumer Follow-up Block | offline-prompt-generator.ts | HIGH | 3h |

**Total Estimated Fix Time:** 19 hours

## Quick Summary

### Bug 0.1: Standard Library Filter
- **Problem:** `isDotNotation` incorrectly classifies Node.js builtins (fs, path, crypto) as internal modules
- **Impact:** Genesis attempts to refactor the Node runtime
- **Fix:** Create stdlib-registry.ts with isExternalDependency() for all 6 languages

### Bug 0.2: Language-Aware Extension Map
- **Problem:** Hardcoded `.py` fallback generates Python filenames in TypeScript projects
- **Impact:** Wrong file extensions in refactoring output
- **Fix:** Create language-utils.ts with getExtension(), getCommentSyntax(), getBarrelFilenames()

### Bug 0.3: Prompt Size Control
- **Problem:** Inlines ALL files without size limit, generates 500KB+ prompts
- **Impact:** Prompts unusable in chat UI
- **Fix:** Create prompt-budget.ts with token budget enforcement and abbreviation

### Bug 0.4: Module Grouper External Filter
- **Problem:** Builds co-import matrix using ALL edges including stdlib/vendor
- **Impact:** Generates steps to move fs and path to shared/
- **Fix:** Apply isExternalDependency() filter before analysis

### Bug 0.5: Import Organizer External Filter
- **Problem:** Generates facades aggregating external deps (e.g., export { readFileSync } from 'fs')
- **Impact:** Creates useless and incorrect barrel files
- **Fix:** Filter external deps before generating facades

### Bug 0.6: Consumer Follow-up Block
- **Problem:** Genesis generates splits without informing LLM of cascading impacts
- **Impact:** LLM doesn't know which consumers need manual updates
- **Fix:** Generate explicit follow-up block with consumer file paths

## Validation After Fix

```bash
npx architect analyze . --json > /tmp/self-analysis.json
npx architect refactor . --dry-run --output-prompts /tmp/genesis-test/

# Verify
grep -r "require('fs')\|from 'fs'\|from 'path'" /tmp/genesis-test/
# Must return 0 results

wc -c /tmp/genesis-test/*.md
# No file should exceed ~120KB (30K tokens × 4 chars)
```

## Checklist

- [ ] Bug 0.1: Stdlib registry created and integrated
- [ ] Bug 0.2: Language-aware extensions implemented
- [ ] Bug 0.3: Prompt budget system enforced
- [ ] Bug 0.4: Module grouper uses external filter
- [ ] Bug 0.5: Import organizer uses external filter
- [ ] Bug 0.6: Consumer follow-up blocks generated
- [ ] All tests pass
- [ ] Self-test validates all 6 fixes
- [ ] No step mentions stdlib modules
- [ ] All file extensions correct per language

## References

- EVOLUTION_PLAN.md (lines 24-516)
- PHASE_0_CRITICAL_BUGS.md (detailed documentation)
- CTO Assessment: v8.1.0 Score 7.2/10
- Action Plan Task 1.1: Documentar & Priorizar Phase 0 Bugs

## Impact

**Current behavior (v8.1.0):**
- Genesis flags Node stdlib modules as refactoring candidates
- Generates prompts that exceed chat UI limits
- LLM receives no information about cascading impacts

**After fixes:**
- Only actual architectural issues detected
- Prompts fit within UI (30K token budget)
- Full transparency about consumer impacts

---

## Labels (add to issue)

```
bug
critical
phase-0
blocking
refactor
```

---

## Assignee & Milestone

- **Assignee:** [Your username]
- **Milestone:** v8.2
- **Priority:** 🔴 CRITICAL

