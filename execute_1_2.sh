#!/bin/bash

# Preflight check and branch definition
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "feature/genesis-phase-1.2" ]; then
    echo "🚨 Erro: Você deve estar na branch feature/genesis-phase-1.2 para executar este script"
    exit 1
fi

echo "🚀 Iniciando registro de commits para a Fase 1.2 (Internacionalização)..."

# Commit 1: i18n Core
git add src/core/locales/ src/core/i18n.ts
git commit -m "feat(i18n): create type-safe translation engine and dictionaries

- Initialized src/core/i18n.ts with dynamic fallback strategy
- Created pt-BR.ts and en.ts with structured keys and parameters
- Replaced fragile JSON approach with TypeScript modules for bundle safety"

# Commit 2: CLI Integration
git add src/adapters/cli.ts
git commit -m "feat(cli): add --locale flag for i18n support

- Added --locale [lang] argument parsing to CLI adapter
- Injected parsed locale into global i18n engine
- Implemented environment fallback logic (LANG/LANGUAGE) defaulting to en"

# Commit 3: Template Refactoring and Testing
git add src/core/agent-generator/templates/core/agents.ts \
        tests/i18n.test.ts \
        package.json
git commit -m "refactor(templates): migrate agent templates to i18n and add tests

- Replaced hardcoded Portuguese strings with i18n.t() calls in agents.ts
- Refactored GenerateFrontendAgent, GenerateBackendAgent, SecurityAgent, QAAgent, TechDebtAgent and CodeReviewChecklist
- Created tests/i18n.test.ts to validate language fallback and interpolation"

echo "✅ Commits criados com sucesso!"
echo ""
echo "Agora crie o Pull Request com as descrições em PR_DESCRIPTION.md"
