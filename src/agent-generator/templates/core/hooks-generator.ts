import { TemplateContext, EnrichedTemplateContext } from '../../types.js';
import { getEnriched } from '../template-helpers.js';

/**
 * Generates executable hook scripts (.sh) for the .agent/hooks/ directory.
 * These are real, runnable shell scripts tied to git lifecycle events.
 *
 * v5.1: Uses project-specific toolchain commands, score thresholds,
 * and coverage targets from the enriched context.
 */

/**
 * Pre-commit hook: lint + build check
 */
export function generatePreCommitHook(ctx: TemplateContext | EnrichedTemplateContext): string {
  const enriched = getEnriched(ctx);
  const tc = enriched.toolchain;
  const config = ctx.config;
  const projectName = ctx.projectName;

  const lintCmd = tc?.lintCmd || 'npx eslint .';
  const buildCmd = tc?.buildCmd || 'npm run build';

  return `#!/bin/bash
# ============================================================
# PRE-COMMIT HOOK — ${projectName}
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
SECRETS_PATTERN='(password|secret|api[_-]?key|access[_-]?token|private[_-]?key)\\s*[:=]\\s*["\\'\\x60][^"\\x60]{8,}'

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
${lintCmd} --quiet 2>/dev/null || {
  echo "❌ BLOQUEADO: Lint falhou."
  echo "   Corrija: ${lintCmd}"
  exit 1
}

# ── 5. Build ──
echo "🔨 Verificando build..."
${buildCmd} 2>/dev/null || {
  echo "❌ BLOQUEADO: Build falhou."
  echo "   Corrija: ${buildCmd}"
  exit 1
}

# ── 6. Debug Statements ──
echo "🐛 Verificando debug statements..."
if echo "$STAGED_FILES" | xargs grep -n 'console\\.log\\|debugger\\|print(' 2>/dev/null | grep -v 'node_modules' | grep -v '.test.'; then
  echo "⚠️  AVISO: Debug statements encontrados. Remova antes do merge."
fi

echo "✅ [pre-commit] Tudo OK — commit liberado."
exit 0
`;
}

/**
 * Pre-push hook: test + score gate
 */
export function generatePrePushHook(ctx: TemplateContext | EnrichedTemplateContext): string {
  const enriched = getEnriched(ctx);
  const tc = enriched.toolchain;
  const config = ctx.config;
  const projectName = ctx.projectName;

  const testCmd = tc?.testCmd || 'npm test';
  const coverageCmd = tc?.coverageCmd || 'npm run test -- --coverage';

  return `#!/bin/bash
# ============================================================
# PRE-PUSH HOOK — ${projectName}
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
${testCmd} || {
  echo "❌ BLOQUEADO: Testes falharam."
  echo "   Corrija antes de fazer push."
  exit 1
}

# ── 3. Coverage Gate ──
echo "📊 Verificando cobertura (mínimo: ${config.coverageMinimum}%)..."
COVERAGE_OUTPUT=$(${coverageCmd} 2>&1 || true)
echo "$COVERAGE_OUTPUT" | tail -5

# Parse coverage percentage (works with Jest/Istanbul output)
COVERAGE=$(echo "$COVERAGE_OUTPUT" | grep -oP 'All files[^|]*\\|\\s*[\\d.]+' | grep -oP '[\\d.]+$' || echo "0")
if [ -n "$COVERAGE" ]; then
  COVERAGE_INT=\${COVERAGE%.*}
  if [ "$COVERAGE_INT" -lt ${config.coverageMinimum} ] 2>/dev/null; then
    echo "⚠️  AVISO: Cobertura ($COVERAGE_INT%) abaixo do mínimo (${config.coverageMinimum}%)"
  fi
fi

# ── 4. Architecture Score Gate ──
echo "🏗️ Verificando score de arquitetura (mínimo: ${config.scoreThreshold}/100)..."
if command -v architect &> /dev/null; then
  SCORE=$(architect score . --json 2>/dev/null | grep -oP '"overall":\\s*\\K[0-9]+' || echo "N/A")
  if [ "$SCORE" != "N/A" ] && [ "$SCORE" -lt ${config.scoreThreshold} ] 2>/dev/null; then
    echo "❌ BLOQUEADO: Score ($SCORE/100) abaixo do mínimo (${config.scoreThreshold}/100)"
    exit 1
  fi
  echo "   Score: $SCORE/100 ✅"
else
  echo "   ⏭️  architect não instalado — skip score gate"
fi

echo "✅ [pre-push] Tudo OK — push liberado."
exit 0
`;
}

/**
 * Post-analysis hook: remediation actions
 */
export function generatePostAnalysisHook(ctx: TemplateContext | EnrichedTemplateContext): string {
  const enriched = getEnriched(ctx);
  const projectName = ctx.projectName;
  const report = ctx.report;

  return `#!/bin/bash
# ============================================================
# POST-ANALYSIS HOOK — ${projectName}
# Gerado por Architect v5.1
#
# Executa após 'architect analyze .' para gerar ações
# de remediação automáticas.
#
# Uso:
#   architect analyze . && bash .agent/hooks/post-analysis.sh
# ============================================================

set -e

echo "🔧 [post-analysis] Processando resultados da análise..."

REPORT_JSON="architect-report.json"
REPORT_HTML="architect-report.html"

# ── 1. Score Evolution ──
CURRENT_SCORE=${report.score.overall}
echo "📊 Score atual: $CURRENT_SCORE/100"
echo "   Meta curto prazo: ${Math.min(100, report.score.overall + 5)}/100"
echo "   Meta médio prazo: ${Math.min(100, report.score.overall + 10)}/100"

# ── 2. Critical Anti-Patterns Alert ──
CRITICAL_COUNT=$(grep -c '"severity":"CRITICAL"' "$REPORT_JSON" 2>/dev/null || echo "0")
HIGH_COUNT=$(grep -c '"severity":"HIGH"' "$REPORT_JSON" 2>/dev/null || echo "0")

if [ "$CRITICAL_COUNT" -gt 0 ]; then
  echo ""
  echo "🔴 ATENÇÃO: $CRITICAL_COUNT anti-patterns CRÍTICOS detectados!"
  echo "   Resolva antes do próximo sprint."
fi

if [ "$HIGH_COUNT" -gt 0 ]; then
  echo "🟠 $HIGH_COUNT anti-patterns HIGH detectados."
fi

# ── 3. Generate Summary ──
echo ""
echo "📋 Resumo:"
echo "   Arquivos: ${report.projectInfo.totalFiles}"
echo "   Linhas: ${report.projectInfo.totalLines.toLocaleString()}"
echo "   Anti-patterns: ${report.antiPatterns.length}"
echo ""

# ── 4. Suggestions ──
if [ -f "$REPORT_JSON" ]; then
  echo "💡 Top 5 sugestões:"
  cat "$REPORT_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data.get('suggestions', [])[:5]:
    print(f'   → {s.get(\"description\", \"\")}')
" 2>/dev/null || echo "   (instale python3 para ver sugestões)"
fi

echo ""
echo "📄 Report HTML: $REPORT_HTML"
echo "📦 Report JSON: $REPORT_JSON"
echo ""
echo "✅ [post-analysis] Concluído."
exit 0
`;
}
