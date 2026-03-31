#!/bin/bash
set -e

echo "🚀 Iniciando Deploy da Fase 1.3: OSS Benchmark & Calibration"

echo "1) Adicionando scripts executados e artefatos gerados..."
git add src/core/anti-patterns.ts src/core/scorer.ts
git add src/scripts/benchmark-runner.ts src/scripts/benchmark-report.ts
git add package.json
git add tests/scorer.test.ts
git add BENCHMARK.md

echo "2) Commitando as mudanças..."
git commit -m "feat(benchmark): add OSS calibration scripts and refine scorer thresholds"

echo "3) Executando o pipeline local (lint + tests)..."
npm run test

echo "4) Enviando para a Origin (GitHub)..."
git push -u origin feature/genesis-phase-1.3

echo "✅ Fase 1.3 Concluída! PR pronto para ser criado e mergeado."
