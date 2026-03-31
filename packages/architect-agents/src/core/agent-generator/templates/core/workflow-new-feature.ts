import { TemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';

/**
 * Generates enterprise-grade new-feature.md workflow.
 * 10 steps with approval gates, mockup-first, backend-first order,
 * integration doc, coverage gate, user story/task templates.
 */
export function generateNewFeatureWorkflow(ctx: TemplateContext): string {
  const { stack, projectName, config, report } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Workflow completo para nova feature em ${projectName}'
---

# 🚀 Workflow: Nova Feature

> **Este workflow é OBRIGATÓRIO para qualquer nova funcionalidade.**
> Cada step tem um gate de aprovação. Pular steps é violação do protocolo.

---

## Pré-requisitos

\`\`\`
□ Li INDEX.md e entendi a estrutura do framework
□ Li 00-general.md (Regras de Ouro)
□ Li PREFLIGHT.md e completei TODAS as fases
□ Li QUALITY-GATES.md e sei quais métricas atender
□ Estou em uma branch feature/ (NUNCA main/develop)
\`\`\`

---

## FASE 0: AÇÃO ZERO — Diagnóstico

> **ANTES de qualquer coisa, fazer diagnóstico do estado atual.**

\`\`\`bash
# Estado do projeto
git branch --show-current
git status

# Build e testes ANTES de começar
${stack.packageManager === 'npm' ? 'npm run build && npm run test' : stack.testFramework === 'pytest' ? 'python -m pytest' : stack.testFramework === 'flutter_test' ? 'flutter test' : 'make test'}

# Score atual
npx @girardelli/architect score .

# Ler lições aprendidas (se existir)
cat LESSONS-LEARNED.md 2>/dev/null || echo "Sem lessons learned"

# Regras de negócio (se existir)
cat BUSINESS-RULES.md 2>/dev/null || echo "Sem business rules"
\`\`\`

\`\`\`
□ Build passando ✓
□ Testes passando ✓
□ Score anotado: ___/100 (não pode regredir)
□ Lessons learned lidos
\`\`\`

---

## FASE 1: Diagnóstico da Feature

\`\`\`
Quero implementar [NOME DA FEATURE].

Contexto:
- Quem usa: [usuário / admin / sistema externo / ...]
- Tem UI: [sim/não]
- Tem API: [sim/não]
- Tem banco: [sim/não]
- Repo: [${ctx.projectName} / monorepo path / ...]

Descrição:
[2-3 frases do ponto de vista do usuário]

Critérios de aceite:
- CA1: [critério mensurável]
- CA2: [critério mensurável]
- CA3: [critério mensurável]
\`\`\`

---

## Step 1: MOCKUP ${stack.hasFrontend || stack.hasMobile ? '(OBRIGATÓRIO)' : '(se tem UI)'}

> **Gate 1 — Primeiro artefato. Nada começa sem mockup aprovado (quando tem UI).**

\`\`\`
╔══════════════════════════════════════════════════════╗
║  O MOCKUP DEVE CONTER:                               ║
║                                                       ║
║  ✓ TODAS as telas/páginas envolvidas                 ║
║  ✓ Estado: com dados (normal)                        ║
║  ✓ Estado: vazio (empty state)                       ║
║  ✓ Estado: carregando (loading)                      ║
║  ✓ Estado: erro (error state)                        ║
║  ✓ TODOS os modais / dialogs                         ║
║  ✓ Mensagens de sucesso                              ║
║  ✓ Mensagens de erro                                 ║
║  ✓ Fluxo completo (passo a passo)                    ║
║  ✓ Padrão visual do sistema (cores, fontes, layout)  ║
${stack.hasFrontend ? '║  ✓ Responsividade (desktop + mobile se web)          ║\n' : ''}${stack.hasMobile ? '║  ✓ Padrão do app (navegação, header, bottom bar)     ║\n' : ''}║                                                       ║
║  Formato: HTML interativo ou imagens anotadas        ║
╚══════════════════════════════════════════════════════╝
\`\`\`

**Apresentar ao humano → Aguardar \`/approved\`**

---

## Step 2: User Stories

> **Gate 2 — Histórias de usuário com critérios de aceite mensuráveis.**

Formato:

\`\`\`markdown
## US-001: [Título]

**Como** [ator],
**Quero** [ação],
**Para** [benefício].

### Critérios de Aceite
- CA1: [critério mensurável]
- CA2: [critério mensurável]

### Regras de Negócio
- RN1: [regra]

### Exceções
- E1: Se [condição], então [comportamento]
\`\`\`

**Apresentar ao humano → Aguardar \`/approved\`**

---

## Step 3: Arquitetura (C4)

> **Gate 3 — Visão técnica da implementação.**

Usar template [C4.md](../templates/C4.md):

\`\`\`
Nível 1 — Contexto: Quem são os atores e sistemas externos?
Nível 2 — Container: Quais serviços/apps são afetados?
Nível 3 — Componente: Quais módulos/classes são criados/modificados?
Nível 4 — Código: Interfaces, DTOs, entidades (se complexo)
\`\`\`

Se a decisão é significativa → criar ADR (template [ADR.md](../templates/ADR.md))

**Apresentar ao humano → Aguardar \`/approved\`**

---

## Step 4: Task Breakdown

> **Gate 4 — Lista de tarefas com estimativa.**

Formato:

\`\`\`markdown
## TASK-001: [Título]
- **US:** US-001
- **Camada:** Backend / Frontend / App / Database
- **Estimativa:** XS / S / M / L / XL
- **Agente:** [quem executa]
- **Deps:** [depende de TASK-XXX, se houver]
\`\`\`

Ordenar por dependência. Backend SEMPRE primeiro.

**Apresentar ao humano → Aguardar \`/approved\`**

---

## Step 5: BDD (Cenários)

> **Gate 5 — Cenários de comportamento para cada critério de aceite.**

Formato (Gherkin):

\`\`\`gherkin
Feature: [Nome da Feature]

  Scenario: [cenário happy path]
    Given [contexto]
    When [ação do usuário]
    Then [resultado esperado]

  Scenario: [cenário de erro]
    Given [contexto]
    When [ação inválida]
    Then [mensagem de erro esperada]

  Scenario: [cenário edge case]
    Given [contexto específico]
    When [ação]
    Then [comportamento esperado]
\`\`\`

**Apresentar ao humano → Aguardar \`/approved\`**

---

## Step 6: TDD (Casos de Teste)

> **Gate 6 — Casos de teste ANTES do código.**

\`\`\`
Para cada TASK:
  1. Listar os testes que serão escritos
  2. Descrever input → output esperado
  3. Incluir testes de erro/exceção
  4. Incluir testes de boundary

Meta: Cobertura ≥ ${config.coverageMinimum}% (INEGOCIÁVEL)
\`\`\`

**Apresentar ao humano → Aguardar \`/approved\`**

---

## Step 7: Implementação — Backend

> **SOMENTE após TODOS os 6 gates aprovados.**

\`\`\`
□ Criar/modificar entities e DTOs
□ Criar/modificar services (lógica de negócio)
□ Criar/modificar controllers (endpoints)
□ Criar migrations (se houver alteração de banco)
□ Escrever testes (RED → GREEN → REFACTOR)
□ Rodar: build ✓ + tests ✓ + coverage ≥ ${config.coverageMinimum}% ✓
\`\`\`

---

## Step 8: Documento de Integração

> **OBRIGATÓRIO se tem frontend/app. Gerado APÓS backend completo.**

\`\`\`markdown
# Documento de Integração: [Feature]

## Endpoints

### [METHOD] /api/v1/[recurso]

**Request:**
\\\`\\\`\\\`json
{
  "campo": "tipo — descrição"
}
\\\`\\\`\\\`

**Response (200):**
\\\`\\\`\\\`json
{
  "campo": "tipo — descrição"
}
\\\`\\\`\\\`

**Erros:**
| Código | Mensagem | Quando |
|--------|----------|--------|
| 400 | Validation error | Input inválido |
| 404 | Not found | Recurso inexistente |

## Regras
- [regra 1]
- [regra 2]
\`\`\`

---

## Step 9: Implementação — Frontend / App

> **Baseado no Documento de Integração.**

\`\`\`
□ Criar/modificar componentes (seguir mockup)
□ Implementar state management
□ Integrar com endpoints (conforme doc de integração)
□ Implementar TODOS os estados (loading, error, empty, data)
□ Escrever testes (unitários + e2e se aplicável)
□ Rodar: build ✓ + tests ✓ + coverage ≥ ${config.coverageMinimum}% ✓
\`\`\`

---

## Step 10: Verificação Final

\`\`\`
╔════════════════════════════════════════════════╗
║  CHECKLIST FINAL — TODOS devem ser ✓          ║
║                                                ║
║  □ Build compila sem erros                     ║
║  □ TODOS os testes passam                      ║
║  □ Cobertura ≥ ${String(config.coverageMinimum).padEnd(3)}%                         ║
║  □ Score ≥ ${String(config.scoreThreshold).padEnd(3)}/100 (sem regressão)        ║
║  □ Lint sem errors                             ║
║  □ Zero anti-patterns CRITICAL novos           ║
║  □ Todos os critérios de aceite cobertos       ║
║  □ Documentação atualizada                     ║
║  □ LESSONS-LEARNED atualizado (se aplicável)   ║
║  □ PR criado com descrição completa            ║
╚════════════════════════════════════════════════╝
\`\`\`

---

**Gerado por Architect v3.1 · Score: ${report.score.overall}/100 · ${new Date().toISOString().split('T')[0]}**
`;
}
