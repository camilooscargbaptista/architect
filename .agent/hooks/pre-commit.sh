#!/bin/bash
# ============================================================
# PRE-COMMIT HOOK — @girardelli/architect
# Gerado por Architect v5.1
#
# Instalação:
#   cp .agent/hooks/pre-commit.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
# ============================================================

set -e

echo "🔍 [pre-commit] Verificando qualidade do código..."

# ── 1. Branch Safety ──
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" || "$BRANCH" == "staging" || "$BRANCH" == "develop" ]]; then
  echo "❌ BLOQUEADO: Commit direto em '$BRANCH' é proibido."
  echo "   Crie uma branch: git checkout -b feature/<nome>"
  exit 1
fi

# ── 2. Secrets Check ──
echo "🔐 Verificando secrets..."
SECRETS_PATTERN='(password|secret|api[_-]?key|access[_-]?token|private[_-]?key)\s*[:=]\s*["\'\x60][^"\x60]{8,}'

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)
if echo "$STAGED_FILES" | xargs grep -ilE "$SECRETS_PATTERN" 2>/dev/null; then
  echo "❌ BLOQUEADO: Possível secret detectado nos arquivos staged."
  echo "   Remova o secret e use variáveis de ambiente."
  exit 1
fi

# ── 3. File Size Check ──
echo "📏 Verificando tamanho de arquivos..."
for file in $STAGED_FILES; do
  if [ -f "$file" ]; then
    LINES=$(wc -l < "$file" 2>/dev/null || echo "0")
    if [ "$LINES" -gt 500 ]; then
      echo "⚠️  AVISO: $file tem $LINES linhas (limite: 500)"
    fi
  fi
done

# ── 4. Lint ──
echo "🧹 Executando lint..."
npm run lint --quiet 2>/dev/null || {
  echo "❌ BLOQUEADO: Lint falhou."
  echo "   Corrija: npm run lint"
  exit 1
}

# ── 5. Build ──
echo "🔨 Verificando build..."
npm run build 2>/dev/null || {
  echo "❌ BLOQUEADO: Build falhou."
  echo "   Corrija: npm run build"
  exit 1
}

# ── 6. Debug Statements ──
echo "🐛 Verificando debug statements..."
if echo "$STAGED_FILES" | xargs grep -n 'console\.log\|debugger\|print(' 2>/dev/null | grep -v 'node_modules' | grep -v '.test.'; then
  echo "⚠️  AVISO: Debug statements encontrados. Remova antes do merge."
fi

echo "✅ [pre-commit] Tudo OK — commit liberado."
exit 0
