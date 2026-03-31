#!/bin/bash
set -e

# Sync with remote before pushing
echo "Pulling latest changes from main..."
git checkout main
git pull origin main

echo "Pushing Phase 5.0 Monorepo Extract feature branch to GitHub..."
git checkout feature/genesis-phase-5.0-monorepo
git push -u origin feature/genesis-phase-5.0-monorepo

echo "✅ Branch successfully pushed!"
echo "Create your PR using the contents of the generated 'pr_description.md'!"
