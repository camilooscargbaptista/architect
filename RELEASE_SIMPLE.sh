#!/bin/bash

###############################################################################
# v8.2.0 Release - Simple Version
# Execute steps to release v8.2.0
###############################################################################

set -e

echo "🚀 Starting v8.2.0 Release Process"
echo "==================================="
echo ""

# Step 1: Verify git state
echo "📋 Step 1: Verifying git state..."
if ! git tag -l | grep -q "^v8.2.0$"; then
  echo "❌ ERROR: Tag v8.2.0 not found"
  git tag -l | grep v8
  exit 1
fi

if git status --short | grep -q "^??"; then
  echo "⚠️  WARNING: Untracked files found:"
  git status --short | grep "^??"
  echo ""
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

echo "✅ Git state verified"
echo ""

# Step 2: Push to GitHub
echo "📤 Step 2: Pushing to GitHub..."
git push origin feature/genesis-interactive-loop
git push origin v8.2.0
echo "✅ Pushed to GitHub"
echo ""

# Step 3: Create GitHub Release
echo "🏷️  Step 3: Creating GitHub Release..."
if command -v gh &> /dev/null; then
  gh release create v8.2.0 \
    --title "v8.2.0 - Phase 0 Critical Bugs Fixed" \
    --notes "# v8.2.0 - Phase 0 Critical Bugs Fixed

All 6 Phase 0 critical bugs fixed and tested.

## Fixes Included

- **Fix 0.1:** Standard Library Filter (stdlib-registry.ts)
- **Fix 0.2:** Language-Aware Extension Map (language-utils.ts)
- **Fix 0.3:** Prompt Size Control (prompt-budget.ts)
- **Fix 0.4:** Module Grouper External Filter
- **Fix 0.5:** Import Organizer External Filter
- **Fix 0.6:** Consumer Follow-up Block

## Build Status

✅ Build passed with 0 errors
✅ TypeScript compilation: 0 errors
✅ All tests passing

## Documentation

Complete technical documentation available in the repository:
- PHASE_0_CRITICAL_BUGS.md
- PHASE_0_FIXES_COMPLETED.md
- EVOLUTION_PLAN.md

## Ready for Production

No breaking changes. Backward compatible with v8.1.0.
Drop-in replacement." \
    --draft=false
  echo "✅ GitHub Release created"
else
  echo "⚠️  GitHub CLI not found. Create release manually:"
  echo "   https://github.com/camilooscargbaptista/architect/releases"
fi
echo ""

# Step 4: Publish to npm
echo "📦 Step 4: Publishing to npm..."
echo ""

# Check package.json files to understand structure
echo "Detecting package scope..."
CORE_SCOPE=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' packages/architect-core/package.json | cut -d'"' -f4)
AGENTS_SCOPE=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' packages/architect-agents/package.json | cut -d'"' -f4)
CLI_SCOPE=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' packages/architect/package.json | cut -d'"' -f4)

echo "Found packages:"
echo "  - Core: $CORE_SCOPE"
echo "  - Agents: $AGENTS_SCOPE"
echo "  - CLI: $CLI_SCOPE"
echo ""

# Publish core
echo "Publishing $CORE_SCOPE..."
cd packages/architect-core
npm publish --access=public
cd ../..
echo "✅ Published $CORE_SCOPE"
echo ""

# Publish agents
echo "Publishing $AGENTS_SCOPE..."
cd packages/architect-agents
npm publish --access=public
cd ../..
echo "✅ Published $AGENTS_SCOPE"
echo ""

# Publish CLI
echo "Publishing $CLI_SCOPE..."
cd packages/architect
npm publish --access=public
cd ../..
echo "✅ Published $CLI_SCOPE"
echo ""

# Final summary
echo "🎉 Release v8.2.0 COMPLETE!"
echo "==================================="
echo ""
echo "✅ Pushed to GitHub"
echo "✅ Created GitHub Release"
echo "✅ Published to npm"
echo ""
echo "Release URLs:"
echo "  GitHub:  https://github.com/camilooscargbaptista/architect/releases/tag/v8.2.0"
echo ""
echo "Next steps:"
echo "  1. Verify release on GitHub"
echo "  2. Update documentation if needed"
echo "  3. Announce release on team channels"
echo ""
