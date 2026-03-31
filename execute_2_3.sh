#!/bin/bash
set -e

echo "🚀 Iniciando Deploy da Fase 2.3: Extensibilidade (v7.0.0)"

echo "1) Formatando e buildando projeto..."
npm run build
npm test

echo "2) Commitando as mudanças..."
git add package.json package-lock.json README.md execute_2_3.sh pr_description.md

# Verifica se há algo para commitar
if ! git diff-index --quiet HEAD --; then
  git commit -m "chore(release): bump version to v7.0.0 (Custom Plugin SDK & PR Feedback integration)"
fi

echo "3) Empurrando para a Origin..."
git push origin feature/genesis-phase-2.3

echo "✅ Fase 2.3 Concluída! Você já pode abrir o Pull Request copiando o markdown de 'pr_description.md'."
