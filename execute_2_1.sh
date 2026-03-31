#!/bin/bash
set -e

echo "🚀 Iniciando Push da Fase 2.1: Architecture-as-Code"

echo "1) Adicionando scripts executados e artefatos gerados..."
git add src/core/types/architect-rules.ts src/core/rules-engine.ts
git add src/adapters/cli.ts
git add src/core/architect_deps.ts
git add src/adapters/html-reporter_deps.ts
git add src/core/agent-generator/engines/suggestion-engine_deps.ts
git add src/core/agent-generator/engines/generation-engine_deps.ts
git add tests/rules-engine.test.ts
git add package.json package-lock.json

echo "2) Commitando as mudanças..."
git commit -m "feat(rules): introduce Architecture-as-Code RulesEngine and watch mode"

echo "3) Executando o pipeline local (lint + tests)..."
npm run test

echo "4) Enviando para a Origin (GitHub)..."
git push -u origin feature/genesis-phase-2.1

echo "✅ Fase 2.1 Concluída! PR pronto para ser criado e mergeado."
