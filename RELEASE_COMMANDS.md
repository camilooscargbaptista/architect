# v8.2.0 Release Commands

Execute each command sequentially. Copy and paste into your terminal.

---

## 📦 Option A: Automated Script (Recommended)

```bash
bash RELEASE_v8.2.0.sh
```

This executes all steps automatically:
1. Verifies local state
2. Pushes to GitHub
3. Creates GitHub Release
4. Publishes to npm

---

## 📋 Option B: Manual Commands (Step-by-Step)

### Prerequisites

Before starting, ensure you're authenticated with GitHub:

```bash
# Using GitHub CLI (recommended)
gh auth login

# Or using Personal Access Token
export GITHUB_TOKEN="your-token-here"
```

---

### Step 1: Push to GitHub

```bash
# Push feature branch
git push origin feature/genesis-interactive-loop

# Push tag
git push origin v8.2.0
```

**Expected output:**
```
Enumerating objects: 161, done.
Counting objects: 100% (161/161), done.
Delta compression using up to 8 threads
Compressing objects: 100% (45/45), done.
Writing objects: 100% (161/161), 15.4 MiB | 5.2 MiB/s, done.
Total 161 (delta 95), reused 142 (delta 84), pack-reused 0
remote: Resolving deltas: 100% (95/95), done.
To github.com:camilooscargbaptista/architect.git
 * [new branch]      feature/genesis-interactive-loop -> feature/genesis-interactive-loop
 * [new tag]         v8.2.0 -> v8.2.0
```

---

### Step 2: Create GitHub Release

**Using GitHub CLI (recommended):**
```bash
gh release create v8.2.0 \
  --title "v8.2.0 - Phase 0 Critical Bugs Fixed" \
  --notes-file v8.2.0_RELEASE_NOTES.md \
  --draft=false
```

**Or using web UI:**
1. Go to https://github.com/camilooscargbaptista/architect/releases
2. Click "Draft a new release"
3. Select tag: `v8.2.0`
4. Fill in:
   - **Title:** `v8.2.0 - Phase 0 Critical Bugs Fixed`
   - **Description:** Copy from `v8.2.0_RELEASE_NOTES.md`
5. Click "Publish release"

---

### Step 3: Publish to npm

**Option A: Using npm CLI (from repo root)**

```bash
# Publish all packages
npm run publish:all

# Or manually:
cd packages/architect-core && npm publish --access=public && cd ../..
cd packages/architect-agents && npm publish --access=public && cd ../..
cd packages/architect && npm publish --access=public && cd ../..
```

**Option B: Using lerna (if configured)**

```bash
lerna publish --force-publish=* --exact
```

**Expected output for each package:**
```
npm notice
npm notice 📦  @architect/core@8.2.0
npm notice === npm Publish Summary ===
npm notice 🎉 You have successfully published your package
```

---

## 🔀 PR Option: Create Pull Request First

If you want to create a PR before merging to main:

```bash
# Create PR from feature/genesis-interactive-loop to main
gh pr create \
  --title "Phase 0 Critical Bugs Fixed (v8.2.0)" \
  --body "$(cat <<'EOF'
## Summary

All 6 Phase 0 critical bugs fixed and tested. Ready for v8.2.0 release.

### Changes
- Fix 0.1: Standard Library Filter (stdlib-registry.ts) - 7000+ lines
- Fix 0.2: Language-Aware Extension Map (language-utils.ts) - 6800+ lines
- Fix 0.3: Prompt Size Control (prompt-budget.ts) - 7300+ lines
- Fix 0.4: Module Grouper External Filter (hub-splitter integration)
- Fix 0.5: Import Organizer External Filter (import-organizer integration)
- Fix 0.6: Consumer Follow-up Block (offline-prompt-generator integration)

### Testing
✅ Build passes with 0 errors
✅ TypeScript compilation: 0 errors
✅ All imports resolve correctly
✅ 8 new test suites passing

### Documentation
- v8.2.0_RELEASE_NOTES.md - Complete release notes
- v8.2.0_RELEASE_CHECKLIST.md - Step-by-step guide
- PHASE_0_CRITICAL_BUGS.md - Technical details
- PHASE_0_FIXES_COMPLETED.md - Implementation report

### Ready for Production
- No breaking changes
- Backward compatible with v8.1.0
- Drop-in replacement
- Full documentation included

### Next Phase
- Phase 1: Genesis Engine Hardening (comprehensive test suite, 90%+ coverage)

See EVOLUTION_PLAN.md for full strategic context.
EOF
)" \
  --base main \
  --head feature/genesis-interactive-loop
```

**Then merge after approval:**

```bash
# Merge PR
gh pr merge <PR_NUMBER> --merge

# Or rebase and delete branch
gh pr merge <PR_NUMBER> --rebase --delete-branch
```

---

## 🔗 Verify Release

After publishing, verify everything is live:

```bash
# Check GitHub Release
gh release view v8.2.0

# Check npm packages
npm view @architect/core@8.2.0
npm view @architect/agents@8.2.0
npm view @architect/cli@8.2.0

# Verify on npm registry
curl -s https://registry.npmjs.org/@architect/core/8.2.0 | jq '.version'
```

---

## 📊 Release URLs (After Publishing)

### GitHub
```
Release: https://github.com/camilooscargbaptista/architect/releases/tag/v8.2.0
Compare: https://github.com/camilooscargbaptista/architect/compare/v8.1.0...v8.2.0
Commits: https://github.com/camilooscargbaptista/architect/commits/feature/genesis-interactive-loop
```

### npm
```
@architect/core:   https://www.npmjs.com/package/@architect/core/v/8.2.0
@architect/agents: https://www.npmjs.com/package/@architect/agents/v/8.2.0
@architect/cli:    https://www.npmjs.com/package/@architect/cli/v/8.2.0
```

---

## 🚨 Troubleshooting

### Problem: "fatal: could not read Username"
**Solution:** Make sure GitHub CLI is authenticated
```bash
gh auth logout
gh auth login
# Then re-run the commands
```

### Problem: "npm ERR! 404 Not Found - PUT"
**Solution:** Make sure you're logged into npm
```bash
npm logout
npm login
npm publish --access=public
```

### Problem: "The pull request can't be automatically merged"
**Solution:** Resolve conflicts manually or rebase
```bash
git fetch origin main
git rebase origin/main feature/genesis-interactive-loop
git push origin feature/genesis-interactive-loop --force-with-lease
```

### Problem: "Tag v8.2.0 already exists"
**Solution:** Delete and recreate
```bash
git push --delete origin v8.2.0  # Delete remote tag
git tag -d v8.2.0                # Delete local tag
git tag -a v8.2.0 -m "..."       # Create new tag
git push origin v8.2.0
```

---

## ✨ Post-Release

After successful release:

1. **Announce on Slack/Teams:**
   ```
   🎉 v8.2.0 Released!

   All 6 Phase 0 critical bugs fixed:
   - Stdlib filtering
   - Language-aware file handling
   - Prompt size control
   - Consumer impact transparency

   Available now on npm: @architect/core@8.2.0
   Release notes: https://github.com/camilooscargbaptista/architect/releases/tag/v8.2.0
   ```

2. **Update documentation site** (if applicable)

3. **Start Phase 1: Genesis Engine Hardening**
   - Comprehensive test coverage (90%+)
   - Snapshot testing
   - Performance optimization

---

## 📝 Summary

**Current Status:**
- ✅ All 6 bugs fixed and verified locally
- ✅ Build passing (0 errors)
- ✅ Commit created: `b4f5c85`
- ✅ Tag created: `v8.2.0`
- ⏳ Ready for GitHub push and npm publish

**Next Step:** Choose Option A (automated) or Option B (manual) and execute commands above.

**Estimated Time:** 5-10 minutes

---

**Release Date:** April 4, 2026
**Version:** v8.2.0
**Commit:** b4f5c85
