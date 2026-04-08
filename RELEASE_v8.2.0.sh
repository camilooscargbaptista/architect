#!/bin/bash

#############################################
# v8.2.0 Release Script
# Execute all steps to release v8.2.0
#############################################

set -e  # Exit on error

echo "🚀 Starting v8.2.0 Release Process"
echo "=================================="
echo ""

# Step 1: Verify local state
echo "📋 Step 1: Verifying local state..."
if ! git diff-index --quiet HEAD --; then
  echo "❌ ERROR: Working directory has uncommitted changes"
  exit 1
fi

if ! git tag -l | grep -q "^v8.2.0$"; then
  echo "❌ ERROR: Tag v8.2.0 not found"
  exit 1
fi

echo "✅ Local state verified"
echo ""

# Step 2: Push to GitHub
echo "📤 Step 2: Pushing to GitHub..."
echo "  - Branch: feature/genesis-interactive-loop"
echo "  - Tag: v8.2.0"
echo ""

git push origin feature/genesis-interactive-loop
git push origin v8.2.0

echo "✅ Pushed to GitHub successfully"
echo ""

# Step 3: Create GitHub Release
echo "🏷️  Step 3: Creating GitHub Release..."
echo "  - Title: v8.2.0 - Phase 0 Critical Bugs Fixed"
echo "  - Description: From v8.2.0_RELEASE_NOTES.md"
echo ""

gh release create v8.2.0 \
  --title "v8.2.0 - Phase 0 Critical Bugs Fixed" \
  --notes-file v8.2.0_RELEASE_NOTES.md \
  --draft=false

echo "✅ GitHub Release created"
echo ""

# Step 4: Publish to npm
echo "📦 Step 4: Publishing to npm registry..."
echo ""

echo "  Publishing @architect/core..."
cd packages/architect-core
npm publish --access=public
cd ../..

echo "  Publishing @architect/agents..."
cd packages/architect-agents
npm publish --access=public
cd ../..

echo "  Publishing @architect/cli..."
cd packages/architect
npm publish --access=public
cd ../..

echo "✅ Published to npm successfully"
echo ""

# Step 5: Verification
echo "✨ Step 5: Generating verification URLs..."
echo ""
echo "GitHub URLs:"
echo "  Release: https://github.com/camilooscargbaptista/architect/releases/tag/v8.2.0"
echo "  Compare: https://github.com/camilooscargbaptista/architect/compare/v8.1.0...v8.2.0"
echo ""
echo "npm URLs:"
echo "  @architect/core:   https://www.npmjs.com/package/@architect/core/v/8.2.0"
echo "  @architect/agents: https://www.npmjs.com/package/@architect/agents/v/8.2.0"
echo "  @architect/cli:    https://www.npmjs.com/package/@architect/cli/v/8.2.0"
echo ""

# Final summary
echo "🎉 Release v8.2.0 COMPLETE!"
echo "=================================="
echo ""
echo "Summary:"
echo "  ✅ Pushed to GitHub"
echo "  ✅ Created GitHub Release"
echo "  ✅ Published to npm"
echo ""
echo "Next steps:"
echo "  1. Verify GitHub Release at the URL above"
echo "  2. Update documentation site (if applicable)"
echo "  3. Announce release on team channels"
echo "  4. Start Phase 1: Genesis Engine Hardening"
echo ""
