#!/bin/bash
echo "=== Iniciando Setup de Refatoração (Fase 2.1) ==="

echo "1. Criando Issue no GitHub..."
gh issue create \
  --title "Refatoração (Fase 2.1): Quebrar html-reporter.ts (God File)" \
  --body "O arquivo src/html-reporter.ts cresceu para ~1800 linhas. Objetivo: Separar CSS, scripts client-side e separar o HTML em sub-seções isoladas (header, score, antipatterns, etc). Requisito: Saída de HTML deve manter 100% de paridade com a versão original." \
  --label "refactor"

echo "2. Criando Branch..."
git checkout main
git pull origin main
git checkout -b feature/refactor-html-reporter

echo "3. Gerando Snapshot de Referência (Anti-Quebra)..."
npm run build
npx architect analyze . > /dev/null
cp architect-report.html referencia-v5-original.html

echo "=== Setup Concluído! ==="
echo "O arquivo referencia-v5-original.html foi criado para checagem byte a byte."
