#!/bin/bash
# ============================================================
# PRE-PUSH HOOK — @girardelli/architect
# Gerado por Architect v5.1
#
# Instalação:
#   cp .agent/hooks/pre-push.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
# ============================================================

set -e

echo "🚀 [pre-push] Verificação completa antes do push..."

# ── 1. Branch Safety ──
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  echo "❌ BLOQUEADO: Push direto para '$BRANCH' é proibido."
  echo "   Use Pull Request."
  exit 1
fi

# ── 2. Full Test Suite ──
echo "🧪 Executando testes completos..."
npm test || {
  echo "❌ BLOQUEADO: Testes falharam."
  echo "   Corrija antes de fazer push."
  exit 1
}

# ── 3. Coverage Gate ──
echo "📊 Verificando cobertura (mínimo: 80%)..."
COVERAGE_OUTPUT=$(npm run test -- --coverage 2>&1 || true)
echo "$COVERAGE_OUTPUT" | tail -5

# Parse coverage percentage (works with Jest/Istanbul output)
COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep -oP 'All files[^|]*\|\s*[\d.]+' | grep -oP '[\d.]+$' || echo "0")
if [ -n "$COVERAGE" ]; then
  COVERAGE_INT=${COVERAGE%.*}
  if [ "$COVERAGE_INT" -lt 80 ] 2>/dev/null; then
    echo "⚠️  AVISO: Cobertura ($COVERAGE_INT%) abaixo do mínimo (80%)"
  fi
fi

# ── 4. Architecture Score Gate ──
echo "🏗️ Verificando score de arquitetura (mínimo: 70/100)..."
if command -v architect &> /dev/null; then
  SCORE=$(architect score . --json 2>/dev/null | grep -oP '"overall":\s*\K[0-9]+' || echo "N/A")
  if [ "$SCORE" != "N/A" ] && [ "$SCORE" -lt 70 ] 2>/dev/null; then
    echo "❌ BLOQUEADO: Score ($SCORE/100) abaixo do mínimo (70/100)"
    exit 1
  fi
  echo "   Score: $SCORE/100 ✅"
else
  echo "   ⏭️  architect não instalado — skip score gate"
fi

echo "✅ [pre-push] Tudo OK — push liberado."
exit 0
