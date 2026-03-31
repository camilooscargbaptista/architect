#!/bin/bash
echo "🚀 Iniciando processo de Commit e Push do Architect Agent Runtime (Phase 3.0 v7.0.0)..."

# Formatação e lint básico
npm run format
npm run lint

# Status para visualização
git status

# Commit tudo com Mensagem Convencional
git add .
git commit -m "feat(runtime): autonomous agent runtime phase 3.0" \
           -m "Implementa a infraestrutura do Architect Agent para modificar código com AST Determinístico e AI Providers agnósticos (OpenAI, Anthropic, Gemini)."

# Push para remote
git push origin HEAD

echo "✅ Código commitado e subido para o repositório remoto na branch feature/genesis-phase-3.0!"
echo "✨ PR pode ser aberto a partir desta branch."
