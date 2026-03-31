#!/bin/bash
set -e

echo "🚀 Iniciando Push da Fase 2.2: PR Comments & Score Delta (GitHub Action)"

echo "1) Adicionando scripts executados e artefatos gerados..."
git add action.yml
git add src/adapters/github-action.ts
git add src/adapters/cli.ts
git add package.json package-lock.json
git add tests/github-action.test.ts
git add .github/workflows/ci.yml

echo "2) Commitando as mudanças..."
git commit -m "feat(ci): implement standalone GitHub Action for automatic PR reviews and Score Delta calculation"

echo "3) Executando o pipeline local (lint + tests)..."
npm run test

echo "4) Enviando para a Origin (GitHub)..."
git push -u origin feature/genesis-phase-2.2

echo "✅ Fase 2.2 Concluída! PR pronto para ser criado e mergeado."
