#!/bin/bash
# ==============================================================================
# 🚀 ARCHITECT GENESIS - PHASE 4.0 (HYGIENE & AUDIT RESOLUTION) PUSH SCRIPT 🚀
# ==============================================================================

echo "==========================================================="
echo " 🧹 INICIANDO DECOLAGEM DA FASE 4.0 PARA O GITHUB"
echo "==========================================================="

# Coleta a branch atual
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "feature/genesis-phase-4.0-hygiene" ]; then
    echo "⚠️  [ALERTA] Você não está na branch da Phase 4.0!"
    echo "Branch atual: $CURRENT_BRANCH"
    echo "Por favor verifique antes de enviar."
    exit 1
fi

echo "✅ Branch correta validada: $CURRENT_BRANCH"
echo "✅ Todos os débitos técnicos (P0/P1) já estão commitados localmente."
echo ""
echo "Enviando os artefatos limpos pra nuvem..."

# Realiza o push associando o tracking remoto
git push -u origin feature/genesis-phase-4.0-hygiene

if [ $? -eq 0 ]; then
    echo ""
    echo "==========================================================="
    echo " 🎉 SUCESSO TOTAL! O FOGUETE ESTÁ EM ÓRBITA!"
    echo "==========================================================="
    echo "A Pipeline CI do GitHub vai rodar automaticamente."
    echo ""
    echo "🔗 PRÓXIMO PASSO: Vá ao GitHub e crie o Pull Request"
    echo "🔗 https://github.com/camilooscargbaptista/architect/pulls"
else
    echo ""
    echo "❌ FALHA NO PUSH! Verifique suas credenciais de rede ou acesso do GitHub."
fi
