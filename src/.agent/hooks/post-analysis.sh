#!/bin/bash
# ============================================================
# POST-ANALYSIS HOOK — src
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
CURRENT_SCORE=83
echo "📊 Score atual: $CURRENT_SCORE/100"
echo "   Meta curto prazo: 88/100"
echo "   Meta médio prazo: 93/100"

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
echo "   Arquivos: 122"
echo "   Linhas: 21,138"
echo "   Anti-patterns: 21"
echo ""

# ── 4. Suggestions ──
if [ -f "$REPORT_JSON" ]; then
  echo "💡 Top 5 sugestões:"
  cat "$REPORT_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for s in data.get('suggestions', [])[:5]:
    print(f'   → {s.get("description", "")}')
" 2>/dev/null || echo "   (instale python3 para ver sugestões)"
fi

echo ""
echo "📄 Report HTML: $REPORT_HTML"
echo "📦 Report JSON: $REPORT_JSON"
echo ""
echo "✅ [post-analysis] Concluído."
exit 0
