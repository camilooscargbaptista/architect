import { TemplateContext } from '../../types/template.js';

/**
 * Generates enterprise-grade fix-bug.md workflow.
 * 10 steps: diagnosis → localization → root cause → RED test → fix → regression → docs.
 */
export function generateFixBugWorkflow(ctx: TemplateContext): string {
    // @ts-ignore - Audit cleanup unused variable
  const { stack, projectName, config, report } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Workflow completo para correção de bug em ${projectName}'
---

# 🐛 Workflow: Fix Bug

> **Bugs não se corrigem por tentativa e erro.**
> Diagnóstico rigoroso → reprodução → root cause → teste RED → fix → regressão.

---

## Pré-requisitos

\`\`\`
□ Li INDEX.md e PREFLIGHT.md
□ Li LESSONS-LEARNED.md (se existir) — talvez esse bug já aconteceu
□ Li ERROR-PATTERNS.md (se existir) — talvez é um padrão conhecido
□ Estou em uma branch fix/ ou hotfix/ (NUNCA main/develop)
□ Build e testes passando ANTES da minha alteração
\`\`\`

---

## Step 1: Diagnóstico Inicial

\`\`\`
Bug: [descrição clara do problema]
Reportado por: [quem reportou]
Ambiente: [produção / staging / dev]
Severidade: [CRITICAL / HIGH / MEDIUM / LOW]

Comportamento atual: [o que acontece]
Comportamento esperado: [o que deveria acontecer]
Como reproduzir:
  1. [passo 1]
  2. [passo 2]
  3. [resultado errado]
\`\`\`

---

## Step 2: Leitura de Contexto

\`\`\`bash
# Verificar LESSONS-LEARNED para bugs similares
grep -i "[termo do bug]" LESSONS-LEARNED.md 2>/dev/null

# Verificar ERROR-PATTERNS
grep -i "[termo do bug]" ERROR-PATTERNS.md 2>/dev/null

# Verificar regras de negócio relevantes
grep -i "[domínio do bug]" BUSINESS-RULES.md 2>/dev/null

# Histórico de commits na área afetada
git log --oneline -20 -- [arquivo ou diretório afetado]
\`\`\`

---

## Step 3: Localização do Problema

\`\`\`bash
# Buscar no código
grep -rn "[termo do erro]" --include="*.${stack.primary === 'Python' ? 'py' : stack.primary === 'Dart' ? 'dart' : 'ts'}" src/

# Verificar logs (se disponível)
# Verificar stack trace

# Mapear o fluxo de dados:
# Input → [onde entra] → [como transforma] → [onde sai] → Output
\`\`\`

\`\`\`
Arquivo(s) suspeito(s): _______________
Função/método suspeito: _______________
Linha(s) suspeita(s): _______________
\`\`\`

---

## Step 4: Root Cause — Identificação da Causa Raiz

\`\`\`
╔══════════════════════════════════════════════╗
║  NUNCA corrigir o SINTOMA.                   ║
║  SEMPRE encontrar a CAUSA RAIZ.              ║
║                                               ║
║  Técnica dos 5 Porquês:                      ║
║  1. Por que o bug acontece? → porque...      ║
║  2. Por que isso? → porque...                ║
║  3. Por que isso? → porque...                ║
║  4. Por que isso? → porque...                ║
║  5. Por que isso? → CAUSA RAIZ               ║
╚══════════════════════════════════════════════╝
\`\`\`

\`\`\`
Causa raiz: _______________
Confiança: [ ] Alta (reproduzi) [ ] Média (hipótese forte) [ ] Baixa (preciso investigar mais)
\`\`\`

> **Se confiança é Baixa → PARAR e investigar mais. Não chutar.**

---

## Step 5: Verificar Testes Existentes

\`\`\`bash
# Testes que cobrem a área afetada
grep -rn "[nome da função/classe]" --include="*.test.*" --include="*.spec.*" tests/ src/

# Rodar testes existentes
${stack.testFramework === 'pytest' ? 'pytest -v -k "[nome do módulo]"' : stack.testFramework === 'flutter_test' ? 'flutter test test/[modulo]_test.dart' : 'npx jest --testPathPattern="[modulo]"'}
\`\`\`

\`\`\`
□ Existem testes para a área afetada? [sim/não]
□ Os testes passam? [sim/não]
□ Os testes cobrem o cenário do bug? [sim/não — se não, criar no Step 6]
\`\`\`

---

## Step 6: Criar Teste RED

> **PRIMEIRO criar um teste que FALHA reproduzindo o bug.**
> Só depois corrigir o código.

\`\`\`
Teste: [nome descritivo do teste]
Input: [dados que reproduzem o bug]
Expected: [resultado correto]
Actual: [resultado errado — o teste deve FALHAR]
\`\`\`

\`\`\`bash
# Rodar e confirmar que FALHA (RED)
${stack.testFramework === 'pytest' ? 'pytest -v -k "[nome do teste]"' : 'npx jest --testNamePattern="[nome do teste]"'}
# DEVE FALHAR ❌
\`\`\`

---

## Step 7: Correção Mínima

\`\`\`
╔══════════════════════════════════════════════╗
║  REGRA: Correção MÍNIMA.                     ║
║                                               ║
║  ✓ Corrigir APENAS a causa raiz              ║
║  ✓ Menor quantidade de linhas possível       ║
║  ✗ NÃO refatorar código adjacente            ║
║  ✗ NÃO "aproveitar" para melhorar outra coisa║
║  ✗ NÃO adicionar features junto com o fix    ║
╚══════════════════════════════════════════════╝
\`\`\`

Após corrigir:
\`\`\`bash
# Rodar o teste do Step 6 — agora deve PASSAR (GREEN)
${stack.testFramework === 'pytest' ? 'pytest -v -k "[nome do teste]"' : 'npx jest --testNamePattern="[nome do teste]"'}
# DEVE PASSAR ✅
\`\`\`

---

## Step 8: Teste de Regressão

\`\`\`bash
# Rodar TODOS os testes (não só o novo)
${stack.testFramework === 'pytest' ? 'pytest' : stack.testFramework === 'flutter_test' ? 'flutter test' : 'npm run test'}

# Build completo
${stack.packageManager === 'npm' ? 'npm run build' : 'make build'}

# Score
npx @girardelli/architect score .
\`\`\`

\`\`\`
□ Teste do bug passa (GREEN) ✓
□ TODOS os outros testes passam ✓
□ Build compila ✓
□ Score não regrediu ✓
\`\`\`

---

## Step 9: Verificação de Fluxos Existentes

\`\`\`
□ Verifiquei que features dependentes não foram afetadas
□ Verifiquei edge cases relacionados
□ Se o bug era em API → verifiquei clientes da API
□ Se o bug era em banco → verifiquei migrations e seeds
\`\`\`

---

## Step 10: Documentação

\`\`\`
□ Atualizar LESSONS-LEARNED.md:
  - O que aconteceu
  - Causa raiz
  - Como foi corrigido
  - Como prevenir no futuro

□ Atualizar ERROR-PATTERNS.md (se é um padrão novo):
  - Padrão do erro
  - Sintomas
  - Solução

□ Commit com mensagem semântica:
  fix: [descrição clara do que foi corrigido]

□ PR criado com:
  - Descrição do bug
  - Causa raiz
  - Solução aplicada
  - Testes adicionados
\`\`\`

---

**Gerado por Architect v3.1 · Score: ${report.score.overall}/100 · ${new Date().toISOString().split('T')[0]}**
`;
}
