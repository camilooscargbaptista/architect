#!/bin/bash
echo "🚀 Iniciando teste do Architect Agent Runtime (Phase 3.0)..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Erro no build"
  exit 1
fi

echo "✅ Build completo. Analisando benchmarks/express com o Autonomous Agent..."
# Usando a flag --auto de propósito em ambiente de teste para não travar o shell script em prompt interativo
node dist/adapters/cli.js execute ./benchmarks/express --auto

echo "✅ Execução autônoma finalizada!"
