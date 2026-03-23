import { TemplateContext, EnrichedTemplateContext } from '../../types.js';
import {
  getEnriched,
  isEnriched,
  depthScale,
  depthAtLeast,
  domainBadge,
  complianceBadges,
  depthIndicator,
  modulesSummaryTable,
  integrationsSummary,
  frameworkBadge,
  toolchainCommands,
  projectStructureBadge,
} from '../template-helpers.js';

/**
 * Generates enterprise-grade AGENT-ORCHESTRATOR.md
 * ~800+ lines: 5-phase protocol, mandatory artifact gates, business interrogation,
 * parallel dispatch, C4/BDD/TDD inline templates, risk matrix, implementation order.
 */
export function generateOrchestrator(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { report, stack, projectName, stackLabel, plan, config } = ctx;
  const layers = report.layers.map(l => l.name).join(', ') || 'Not detected';
  const antiPatterns = report.antiPatterns.map(a => `${a.name} (${a.severity})`).join(', ') || 'None';
  const agentDispatch = buildAgentDispatch(ctx);
  const businessQuestions = buildBusinessQuestions(ctx);

  // Extract toolchain commands for Quality Gates (dynamic per-stack)
  const enrichedCtx = isEnriched(ctx) ? ctx : null;
  const buildCmd = enrichedCtx?.toolchain?.buildCmd || 'npm run build';
  const testCmd = enrichedCtx?.toolchain?.testCmd || 'npm run test';

  return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'META-AGENT ORQUESTRADOR — Centro de comando para ${projectName}'
  priority: CRITICAL
agent_card:
  id: 'orchestrator'
  name: 'Agent Orchestrator'
  role: 'coordination'
  capabilities: [request-decomposition, agent-dispatch, plan-consolidation, quality-verification, artifact-gating]
  inputs: [user-story, feature-request, bug-report, refactoring-request]
  outputs: [consolidated-plan, implementation-blocks, effort-estimate, architecture-docs]
  depends_on: []
version: 3.1.0
---

# 🎭 AGENT-ORCHESTRATOR: ${projectName}

> **Centro de comando.** Toda requisição passa por aqui.
> **Nenhuma linha de código é escrita sem os artefatos obrigatórios.**

---

## ⛔ REGRA ABSOLUTA: ARTEFATOS ANTES DE CÓDIGO

\`\`\`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ANTES de escrever QUALQUER linha de código, os seguintes  ║
║   artefatos DEVEM existir e ser APROVADOS pelo humano:      ║
║                                                              ║
║   1. 🎨 MOCKUP (se tem UI)                                  ║
║      → Todas as telas, estados, erros, modais, mensagens    ║
║      → Seguir padrão visual do sistema                      ║
║                                                              ║
║   2. 📖 USER STORIES                                        ║
║      → Como [ator], quero [ação], para [benefício]          ║
║      → Critérios de aceite mensuráveis                      ║
║                                                              ║
║   3. 🏗️  ARQUITETURA (C4)                                   ║
║      → Contexto, Container, Componente, Código              ║
║      → Decisões arquiteturais (ADR)                         ║
║                                                              ║
║   4. 📋 TAREFAS                                             ║
║      → Breakdown com TASK-XXX                               ║
║      → Estimativa T-shirt (XS/S/M/L/XL)                    ║
║                                                              ║
║   5. 🧪 BDD (cenários)                                      ║
║      → Given/When/Then para cada critério de aceite         ║
║                                                              ║
║   6. 🔬 TDD (casos de teste)                                ║
║      → RED → GREEN → REFACTOR                               ║
║      → Cobertura mínima: ${config.coverageMinimum}%                           ║
║                                                              ║
║   ⚠️  PRODUZIR APENAS UM IMPLEMENTATION PLAN SEM ESTES      ║
║      ARTEFATOS É VIOLAÇÃO DO PROTOCOLO.                     ║
║                                                              ║
║   ORDEM DE IMPLEMENTAÇÃO:                                    ║
║   1° Backend  →  2° Doc. Integração  →  3° Frontend/App    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
\`\`\`

---

## 📊 Contexto do Projeto

| Métrica | Valor |
|---------|-------|
| **Projeto** | ${projectName} |
| **Stack** | ${stackLabel} |
| **Score Atual** | ${report.score.overall}/100 |
| **Meta de Score** | ${Math.min(100, report.score.overall + 10)}/100 |
| **Camadas** | ${layers} |
| **Anti-Patterns** | ${antiPatterns} |
| **Arquivos** | ${report.projectInfo.totalFiles} |
| **Linhas** | ${report.projectInfo.totalLines.toLocaleString()} |
| **Cobertura Mínima** | ${config.coverageMinimum}% |
| **Refatorações Pendentes** | ${plan.steps.length} steps |

${depthAtLeast(ctx, 'medium') ? `\n---\n\n## 📍 Contexto Enriquecido\n\n${depthIndicator(ctx)} · ${projectStructureBadge(ctx)}\n\n${frameworkBadge(ctx)}\n${domainBadge(ctx)}${modulesSummaryTable(ctx) ? `\n### 📦 Resumo de Módulos\n\n${modulesSummaryTable(ctx)}` : ''}${integrationsSummary(ctx)}${complianceBadges(ctx)}${toolchainCommands(ctx)}` : ''}

---

## 🔄 Protocolo de Orquestração (5 Fases)

### FASE 0: Parsing da Requisição

Ao receber qualquer requisição, CLASSIFICAR imediatamente:

\`\`\`
✓ Nome da feature/fix: _______________
✓ Tipo: [ ] Feature  [ ] Bug Fix  [ ] Refactoring  [ ] Documentation
✓ Camadas tocadas: [ ] Backend  [ ] Frontend  [ ] Mobile  [ ] Database
✓ Tem UI: [ ] Sim  [ ] Não
✓ Complexidade: [ ] XS (<2h)  [ ] S (2-4h)  [ ] M (4-8h)  [ ] L (1-3d)  [ ] XL (3d+)
✓ Assunções (listar): _______________
✓ Riscos identificados: _______________
\`\`\`

Se houver QUALQUER dúvida na classificação → **PERGUNTAR ao humano**.

### FASE 1: Interrogação de Negócio

Antes de qualquer design, RESPONDER estas perguntas:

${businessQuestions}

> **Se não conseguir responder ≥ 70% das perguntas relevantes → PERGUNTAR ao humano.**

### FASE 2: Disparo de Agentes (Paralelo)

\`\`\`
ORQUESTRADOR decompõe a requisição
    │
${agentDispatch}    │
    └──→ CONSOLIDAÇÃO
\`\`\`

Cada agente recebe:
- Contexto do projeto (score, stack, anti-patterns)
- Requisição decomposta (sua parte)
- Constraints (regras, patterns proibidos)
- Output esperado (formato e escopo)

### FASE 3: Consolidação

O orquestrador consolida as respostas dos agentes em:

1. **Plano Unificado** com:
   - Diagrama de arquitetura (C4)
   - Cenários BDD
   - Casos de teste TDD
   - Estimativa de esforço (T-shirt)
   - Riscos e mitigações
   - Decisões arquiteturais (ADR)

2. **6 Gates para Aprovação** (apresentar um de cada vez):
   - Gate 1: MOCKUP → \`/approved\`
   - Gate 2: User Stories → \`/approved\`
   - Gate 3: Arquitetura → \`/approved\`
   - Gate 4: Tasks → \`/approved\`
   - Gate 5: BDD → \`/approved\`
   - Gate 6: TDD → \`/approved\`

### FASE 4: Implementação (Após Todas Aprovações)

\`\`\`
╔════════════════════════════════════════════════╗
║  ORDEM OBRIGATÓRIA DE IMPLEMENTAÇÃO:          ║
║                                                ║
║  1° BACKEND                                    ║
║     └─→ Controllers, Services, Entities, DTOs  ║
║     └─→ Testes unitários + integração          ║
║     └─→ Migrations (se houver)                 ║
║                                                ║
║  2° DOCUMENTO DE INTEGRAÇÃO                    ║
║     └─→ Endpoints, payloads, erros             ║
║     └─→ Exemplos de request/response           ║
║     └─→ Contrato para frontend/app             ║
║                                                ║
║  3° FRONTEND / APP                             ║
║     └─→ Baseado no documento de integração     ║
║     └─→ Componentes, pages, state              ║
║     └─→ Testes e2e                             ║
╚════════════════════════════════════════════════╝
\`\`\`

### FASE 5: Verificação e Entrega

\`\`\`
□ Build compila sem erros
□ Todos os testes passam
□ Cobertura ≥ ${config.coverageMinimum}%
□ Score ≥ ${config.scoreThreshold}/100
□ Zero anti-patterns CRITICAL novos
□ Sem regressão de score
□ Lint sem warnings
□ Documentação atualizada
\`\`\`

---

## 📐 Templates Inline

### Template: User Story

\`\`\`markdown
## US-XXX: [Título]

**Como** [ator],
**Quero** [ação],
**Para** [benefício].

### Critérios de Aceite

- CA1: [critério mensurável]
- CA2: [critério mensurável]
- CA3: [critério mensurável]

### Regras de Negócio

- RN1: [regra]
- RN2: [regra]

### Notas Técnicas

- [observação relevante]
\`\`\`

### Template: Task Breakdown

\`\`\`markdown
## TASK-XXX: [Título]

**User Story:** US-XXX
**Estimativa:** [XS|S|M|L|XL]
**Camada:** [Backend|Frontend|App|Database]
**Agente:** [nome do agente]

### Descrição
[o que precisa ser feito]

### Critério de Done
- [ ] Implementado
- [ ] Testado (cobertura ≥ ${config.coverageMinimum}%)
- [ ] Code review
- [ ] Documentação
\`\`\`

### Template: ADR (Architecture Decision Record)

\`\`\`markdown
## ADR-XXX: [Título da Decisão]

**Status:** [proposed | accepted | deprecated | superseded]
**Data:** [YYYY-MM-DD]

### Contexto
[Por que essa decisão é necessária?]

### Decisão
[O que foi decidido?]

### Consequências
[Positivas e negativas]

### Alternativas Consideradas
1. [alternativa 1] — descartada porque...
2. [alternativa 2] — descartada porque...
\`\`\`

---

## ⚖️ Matriz de Risco

| Risco | Probabilidade | Impacto | Mitigação |
|-------|-------------|---------|-----------|
| Regressão de testes | Média | Alto | CI/CD com gate obrigatório |
| Degradação de score | Média | Médio | architect score antes de PR |
| Breaking changes em API | Alta | Crítico | Versionamento + integration doc |
| Security vulnerability | Baixa | Crítico | SECURITY-AUDITOR em toda feature |
| Performance degradation | Média | Alto | Benchmark antes/depois |

---

## 🏷️ T-Shirt Sizing

| Size | Duração | Scope | Gates |
|------|---------|-------|-------|
| **XS** | < 2h | Fix pontual, 1 arquivo | Simplificado (skip mockup se sem UI) |
| **S** | 2-4h | Fix + teste, 2-3 arquivos | Gates 2, 5, 6 obrigatórios |
| **M** | 4-8h | Feature pequena, 1 camada | Todos os 6 gates |
| **L** | 1-3 dias | Feature multi-camada | Todos + ADR |
| **XL** | 3+ dias | Feature épica | Todos + ADR + Threat Model |

---

## 🔀 Protocolo de Conflitos

Quando dois agentes discordam:

1. **Identificar** o ponto de conflito
2. **Documentar** ambas as posições com prós/contras
3. **Escalar** ao humano com recomendação
4. **Registrar** a decisão como ADR

> **NUNCA resolver conflitos automaticamente.** O humano decide.

---

## 🔧 Quality Gates (Enforcement)

\`\`\`
╔══════════════════════════════════════════╗
║  BUILD GATE                              ║
║  $ ${buildCmd}
║  Resultado: PASS ou BLOCK                ║
╠══════════════════════════════════════════╣
║  TEST GATE                               ║
║  $ ${testCmd}
║
║  Resultado: PASS ou BLOCK                ║
╠══════════════════════════════════════════╣
║  COVERAGE GATE                           ║
║  Mínimo: ${config.coverageMinimum}%                            ║
║  Resultado: PASS ou BLOCK                ║
║  ⚠️  INEGOCIÁVEL                         ║
╠══════════════════════════════════════════╣
║  SCORE GATE                              ║
║  $ architect score ./src                 ║
║  Mínimo: ${config.scoreThreshold}/100                        ║
║  Regressão: NÃO PERMITIDA               ║
╚══════════════════════════════════════════╝
\`\`\`

---

**Gerado por Architect v3.1 · Score: ${report.score.overall}/100 · ${new Date().toISOString().split('T')[0]}**
`;
}

function buildAgentDispatch(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { stack } = ctx;
  let dispatch = '';

  // Add module context if enriched
  const enriched = isEnriched(ctx) ? ctx : null;
  const moduleContext = enriched?.modules?.length
    ? ` (${enriched.modules.slice(0, 3).map((m: any) => m.name).join(', ')})`
    : '';

  if (stack.hasBackend) {
    dispatch += `    ├──→ [${stack.primary.toUpperCase()}-BACKEND-DEVELOPER]${moduleContext}\n`;
    dispatch += `    │    • Arquitetura de serviços e APIs\n`;
    dispatch += `    │    • Lógica de negócio e validações\n`;
    dispatch += `    │    • Entities, DTOs, migrations\n`;
    dispatch += `    │\n`;
  }
  if (stack.hasFrontend) {
    const fw = stack.frameworks.find(f => ['Angular', 'Vue', 'Next.js', 'React'].includes(f)) || 'FRONTEND';
    dispatch += `    ├──→ [${fw.toUpperCase().replace('.', '')}-FRONTEND-DEVELOPER]\n`;
    dispatch += `    │    • Componentes e páginas\n`;
    dispatch += `    │    • State management e formulários\n`;
    dispatch += `    │    • UX responsiva\n`;
    dispatch += `    │\n`;
  }
  if (stack.hasMobile) {
    dispatch += `    ├──→ [FLUTTER-UI-DEVELOPER]\n`;
    dispatch += `    │    • Screens e widgets\n`;
    dispatch += `    │    • Navegação e integração API\n`;
    dispatch += `    │\n`;
  }
  if (stack.hasDatabase) {
    dispatch += `    ├──→ [DATABASE-ENGINEER]\n`;
    dispatch += `    │    • Schema design e migrations\n`;
    dispatch += `    │    • Índices e performance de queries\n`;
    dispatch += `    │\n`;
  }

  dispatch += `    ├──→ [SECURITY-AUDITOR]\n`;
  dispatch += `    │    • Análise de ameaças (STRIDE)\n`;
  dispatch += `    │    • Compliance check\n`;
  dispatch += `    │\n`;
  dispatch += `    ├──→ [QA-TEST-ENGINEER]\n`;
  dispatch += `    │    • Plano de testes\n`;
  dispatch += `    │    • Cobertura mínima: ${ctx.config.coverageMinimum}%\n`;
  dispatch += `    │\n`;
  dispatch += `    └──→ [TECH-DEBT-CONTROLLER]\n`;
  dispatch += `         • Débito técnico existente\n`;
  dispatch += `         • Refatorações pré-requisito\n`;

  return dispatch;
}

function buildBusinessQuestions(ctx: TemplateContext | EnrichedTemplateContext): string {
  const questions = [
    'Q1: Quem são os atores envolvidos? (personas)',
    'Q2: Qual o impacto em receita/negócio?',
    'Q3: Existem regras de negócio específicas?',
    'Q4: Quais métricas de sucesso?',
    'Q5: Há requisitos de compliance (LGPD, PCI, etc)?',
    'Q6: Quais módulos/serviços são afetados?',
    'Q7: Quais entidades de banco são tocadas?',
    'Q8: Existe fluxo de dados entre sistemas?',
    'Q9: Precisa de versionamento de API?',
    'Q10: Há integrações externas envolvidas?',
  ];

  // Add domain-specific questions if enriched context available
  const enriched = isEnriched(ctx) ? ctx : null;
  if (enriched?.domain) {
    const { domain } = enriched;
    questions.push(`Q11: Como isso se alinha com o domínio ${domain.domain}?`);

    if (domain.compliance?.length) {
      const complianceNames = domain.compliance.map((c: any) => c.name).join(', ');
      questions.push(`Q12: Como garantir conformidade com ${complianceNames}?`);
    }

    if (domain.integrations?.length) {
      const integrationNames = domain.integrations.slice(0, 3).map((i: any) => i.name).join(', ');
      questions.push(`Q13: Como essa mudança afeta as integrações com ${integrationNames}?`);
    }
  }

  if (ctx.stack.hasDatabase) {
    const startIdx = enriched?.domain ? 14 : 11;
    questions.push(
      `Q${startIdx}: Volume estimado de dados?`,
      `Q${startIdx + 1}: Há picos de uso previsíveis?`,
      `Q${startIdx + 2}: Processamento síncrono ou assíncrono?`,
    );
  }

  let nextQ = questions.length + 1;
  questions.push(
    `Q${nextQ++}: Quem precisa de autenticação?`,
    `Q${nextQ++}: Quais permissões são necessárias?`,
    `Q${nextQ++}: Há dados sensíveis envolvidos?`,
    `Q${nextQ++}: Quais ameaças são relevantes?`,
  );

  return questions.map(q => `- **${q}**`).join('\n');
}
