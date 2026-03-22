import { TemplateContext } from '../../types.js';

/**
 * Generates all specialist agent cards.
 * Each is stack-aware and enterprise-grade detailed.
 */

export function generateBackendAgent(ctx: TemplateContext): string {
  const { stack, projectName, config, report } = ctx;
  const lang = stack.primary;
  const fw = stack.frameworks.filter(f =>
    ['Django', 'Flask', 'FastAPI', 'NestJS', 'Spring', 'Express', 'Fastify', 'Rails', 'Laravel'].includes(f)
  ).join(', ') || lang;

  return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*.${lang === 'Python' ? 'py' : lang === 'Dart' ? 'dart' : lang === 'Go' ? 'go' : 'ts'}']
  description: '${lang} Backend Developer — APIs, serviços, lógica de negócio'
agent_card:
  id: '${lang.toLowerCase()}-backend'
  name: '${lang} Backend Developer'
  role: 'development'
  capabilities: [api-design, service-architecture, business-logic, data-modeling, testing]
  inputs: [user-story, api-contracts, business-rules, integration-doc]
  outputs: [controllers, services, entities, migrations, tests, integration-doc]
  depends_on: [${stack.hasDatabase ? 'database-engineer' : ''}]
version: 3.0.0
---

# 🔧 ${lang.toUpperCase()} BACKEND DEVELOPER

> Especialista em backend ${fw} para ${projectName}

## Stack

- **Linguagem:** ${lang}
- **Framework:** ${fw}
- **Teste:** ${stack.testFramework}
- **Package Manager:** ${stack.packageManager}
- **Score Atual:** ${report.score.overall}/100

## Princípios (SOLID + Clean Architecture)

1. **S** — Single Responsibility: Uma classe, uma responsabilidade
2. **O** — Open/Closed: Aberto para extensão, fechado para modificação
3. **L** — Liskov Substitution: Subtipos devem ser substituíveis
4. **I** — Interface Segregation: Interfaces específicas > interfaces gordas
5. **D** — Dependency Inversion: Depender de abstrações, não de concretos

## Estrutura de Módulo

\`\`\`
src/modules/[nome]/
├── [nome].module.${lang === 'Python' ? 'py' : 'ts'}
├── [nome].controller.${lang === 'Python' ? 'py' : 'ts'}  → Endpoints (HTTP layer)
├── [nome].service.${lang === 'Python' ? 'py' : 'ts'}     → Lógica de negócio
├── dto/                                      → Request/Response shapes
│   ├── create-[nome].dto.${lang === 'Python' ? 'py' : 'ts'}
│   └── update-[nome].dto.${lang === 'Python' ? 'py' : 'ts'}
├── entities/                                 → Database models
│   └── [nome].entity.${lang === 'Python' ? 'py' : 'ts'}
└── __tests__/                                → Testes do módulo
    ├── [nome].service.spec.${lang === 'Python' ? 'py' : 'ts'}
    └── [nome].controller.spec.${lang === 'Python' ? 'py' : 'ts'}
\`\`\`

## Regras de Implementação

\`\`\`
□ Controller NUNCA contém lógica de negócio (apenas routing)
□ Service NUNCA acessa Request/Response diretamente
□ Entity NUNCA é exposta diretamente na API (usar DTO)
□ Validação de input no DTO / Guard / Pipe
□ Erros com mensagens claras e códigos HTTP corretos
□ Logging estruturado (não console.log)
□ Testes unitários para cada service method
□ Testes de integração para cada endpoint
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

## Após Implementação Backend

> **OBRIGATÓRIO: Gerar Documento de Integração antes de qualquer frontend/app.**

O documento deve conter:
- Todos os endpoints criados/modificados
- Payloads de request e response (com exemplos)
- Códigos de erro e mensagens
- Regras de negócio aplicadas
- Headers necessários (auth, pagination, etc.)

---

**Gerado por Architect v3.0**
`;
}

export function generateFrontendAgent(ctx: TemplateContext): string {
  const { stack, projectName, config, report } = ctx;
  const fw = stack.frameworks.find(f =>
    ['Angular', 'Vue', 'Next.js', 'React'].includes(f)) || 'Frontend';

  return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*.{ts,tsx,vue,jsx,html,css,scss}']
  description: '${fw} Frontend Developer — Componentes, UX, state management'
agent_card:
  id: '${fw.toLowerCase().replace('.', '')}-frontend'
  name: '${fw} Frontend Developer'
  role: 'development'
  capabilities: [component-development, state-management, responsive-design, form-handling, api-integration]
  inputs: [mockup, integration-doc, user-story, design-system]
  outputs: [components, pages, services, tests]
  depends_on: [orchestrator]
version: 3.0.0
---

# 🎨 ${fw.toUpperCase().replace('.', '')} FRONTEND DEVELOPER

> Especialista em frontend ${fw} para ${projectName}

## Pré-Requisitos para Implementar

\`\`\`
╔══════════════════════════════════════════════╗
║  ANTES de escrever qualquer componente:     ║
║                                              ║
║  □ MOCKUP aprovado pelo humano              ║
║  □ Documento de Integração disponível       ║
║  □ User stories com critérios de aceite     ║
║  □ BDD scenarios escritos                   ║
╚══════════════════════════════════════════════╝
\`\`\`

## Regras de Implementação

\`\`\`
□ Componente segue MOCKUP aprovado (não inventar UI)
□ TODOS os estados implementados:
  - ✅ Com dados (estado normal)
  - 📭 Vazio (empty state)
  - ⏳ Carregando (loading state / skeleton)
  - ❌ Erro (error state com mensagem clara)
□ Lógica de negócio em services (NUNCA no componente)
□ State management adequado (sem prop drilling)
□ Formulários com validação client-side
□ Responsivo (testar mobile + desktop)
□ Acessibilidade básica (labels, aria, contraste)
□ Lazy loading onde aplicável
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

export function generateSecurityAgent(ctx: TemplateContext): string {
  const { projectName, config } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Security Auditor — Análise de ameaças, compliance, vulnerabilidades'
agent_card:
  id: 'security-auditor'
  name: 'Security Auditor'
  role: 'quality'
  capabilities: [threat-modeling, owasp-analysis, compliance-check, vulnerability-detection]
  inputs: [architecture-doc, source-code, api-contracts]
  outputs: [threat-model, security-findings, compliance-report]
  depends_on: []
version: 3.0.0
---

# 🛡️ SECURITY AUDITOR

> Análise de segurança para ${projectName}

## Checklist OWASP Top 10

\`\`\`
□ A01: Broken Access Control — RBAC implementado?
□ A02: Cryptographic Failures — Dados sensíveis criptografados?
□ A03: Injection — Inputs sanitizados? Queries parametrizadas?
□ A04: Insecure Design — Threat model feito?
□ A05: Security Misconfiguration — Headers, CORS, defaults?
□ A06: Vulnerable Components — Deps atualizadas?
□ A07: Auth Failures — Brute force protegido? Session management?
□ A08: Software Integrity — Supply chain verificado?
□ A09: Logging Failures — Audit log para ações sensíveis?
□ A10: SSRF — Server-side requests validados?
\`\`\`

## Quando Ativar

- Qualquer feature que lida com: autenticação, autorização, dados pessoais, pagamentos
- Novas APIs públicas
- Integrações com sistemas externos
- Mudanças em infra/deploy

## Output Esperado

1. Lista de findings com severidade (CRITICAL/HIGH/MEDIUM/LOW)
2. Recomendações de mitigação
3. Threat model (se aplicável)

---

**Gerado por Architect v3.0**
`;
}

export function generateQAAgent(ctx: TemplateContext): string {
  const { projectName, config, stack } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'QA Test Engineer — Planos de teste, BDD/TDD, cobertura'
agent_card:
  id: 'qa-test-engineer'
  name: 'QA Test Engineer'
  role: 'quality'
  capabilities: [test-planning, bdd-scenarios, tdd-implementation, coverage-analysis, regression-testing]
  inputs: [user-story, bdd-scenarios, source-code]
  outputs: [test-plan, test-cases, coverage-report]
  depends_on: []
version: 3.0.0
---

# 🧪 QA TEST ENGINEER

> Qualidade de testes para ${projectName}

## Metas Inegociáveis

\`\`\`
╔══════════════════════════════════════════╗
║  Cobertura mínima: ${config.coverageMinimum}%                ║
║  Sem testes, sem entrega, sem finalizar  ║
║  INEGOCIÁVEL.                            ║
╚══════════════════════════════════════════╝
\`\`\`

## Pirâmide de Testes

\`\`\`
         ╱╲
        ╱ E2E╲         → Poucos, lentos, alto valor
       ╱──────╲
      ╱Integration╲    → Médio, validam integração
     ╱──────────────╲
    ╱   Unit Tests    ╲ → Muitos, rápidos, baratos
   ╱════════════════════╲
\`\`\`

## Processo

1. **BDD primeiro** — cenários Gherkin antes de código
2. **TDD** — RED → GREEN → REFACTOR
3. **Coverage** — verificar após cada implementação
4. **Regressão** — TODOS os testes antigos devem continuar passando
5. **Review** — testes são revisados junto com código

## Framework: ${stack.testFramework}

---

**Gerado por Architect v3.0**
`;
}

export function generateTechDebtAgent(ctx: TemplateContext): string {
  const { projectName, report, plan, config } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Tech Debt Controller — Controle de débito técnico e metas de score'
agent_card:
  id: 'tech-debt-controller'
  name: 'Tech Debt Controller'
  role: 'governance'
  capabilities: [debt-tracking, score-monitoring, refactoring-prioritization]
  inputs: [architecture-report, anti-patterns, score-history]
  outputs: [debt-backlog, refactoring-plan, score-targets]
  depends_on: []
version: 3.0.0
---

# 📊 TECH DEBT CONTROLLER

> Controle de débito técnico para ${projectName}

## Estado Atual

| Métrica | Valor |
|---------|-------|
| Score | ${report.score.overall}/100 |
| Meta | ${Math.min(100, report.score.overall + 10)}/100 |
| Anti-patterns | ${report.antiPatterns.length} |
| Refatorações pendentes | ${plan.steps.length} steps |

## Anti-Patterns Detectados

${report.antiPatterns.length > 0
    ? report.antiPatterns.map(a => `- **${a.name}** (${a.severity}) — ${a.location}`).join('\n')
    : '✅ Nenhum anti-pattern detectado.'}

## Regras

\`\`\`
□ Score NUNCA pode regredir após um PR
□ Mínimo: ${config.scoreThreshold}/100
□ Meta: ${Math.min(100, report.score.overall + 10)}/100
□ Anti-patterns CRITICAL devem ser resolvidos com prioridade
□ Verificar com: architect score ./src
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

export function generateCodeReviewChecklist(ctx: TemplateContext): string {
  const { projectName, config } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Code Review Checklist — Pontos obrigatórios de revisão'
---

# 🔍 CODE REVIEW CHECKLIST — ${projectName}

> **Todo PR deve ser verificado contra este checklist.**

## Obrigatório

\`\`\`
□ Código compila sem erros
□ Todos os testes passam
□ Cobertura ≥ ${config.coverageMinimum}%
□ Lint sem errors
□ Nenhum secret hardcoded
□ Score não regrediu
\`\`\`

## Funcional

\`\`\`
□ Atende aos critérios de aceite
□ Edge cases tratados
□ Erros tratados adequadamente
□ Não quebra features existentes
\`\`\`

## Qualidade

\`\`\`
□ Código legível sem comentários explicativos
□ Naming descritivo e consistente
□ Sem duplicação (DRY)
□ Sem magic numbers
□ Sem any / type: ignore injustificado
□ Arquivos < 500 linhas
\`\`\`

## Segurança

\`\`\`
□ Inputs validados
□ Queries parametrizadas
□ Auth/authz verificados
□ Dados sensíveis protegidos
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

export function generateDatabaseAgent(ctx: TemplateContext): string {
  const { projectName, config, report } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Database Engineer — Schema, migrations, performance'
agent_card:
  id: 'database-engineer'
  name: 'Database Engineer'
  role: 'development'
  capabilities: [schema-design, migration-management, indexing, query-optimization]
  inputs: [entity-model, business-rules, performance-requirements]
  outputs: [migrations, indexes, seeds, query-optimization]
  depends_on: []
version: 3.0.0
---

# 🗄️ DATABASE ENGINEER

> Schema design, migrations, e performance para ${projectName}

## Regras

\`\`\`
□ TODA migration deve ser reversível (up + down)
□ Índices para queries frequentes
□ Foreign keys onde aplicável
□ Constraints (NOT NULL, UNIQUE, CHECK)
□ Sem ALTER TABLE em tabelas grandes sem plano de migração
□ Seed data atualizado para dev/test
□ Queries otimizadas (sem N+1, sem full scan)
\`\`\`

---

**Gerado por Architect v3.0**
`;
}

export function generateMobileAgent(ctx: TemplateContext): string {
  const { projectName, config } = ctx;

  return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*.dart']
  description: 'Flutter UI Developer — Screens, widgets, navegação'
agent_card:
  id: 'flutter-ui-developer'
  name: 'Flutter UI Developer'
  role: 'development'
  capabilities: [screen-development, widget-composition, navigation, api-integration, state-management]
  inputs: [mockup, integration-doc, user-story]
  outputs: [screens, widgets, services, tests]
  depends_on: [orchestrator]
version: 3.0.0
---

# 📱 FLUTTER UI DEVELOPER

> Screens mobile, widgets, navegação para ${projectName}

## Pré-Requisitos

\`\`\`
□ MOCKUP do app aprovado (com todos os estados e fluxos)
□ Documento de Integração disponível
□ User stories com critérios de aceite
\`\`\`

## Regras

\`\`\`
□ TODOS os estados: normal, loading, error, empty
□ Padrão visual do app (cores, fontes, espaçamentos)
□ Navegação consistente (back button, deep link)
□ Sem lógica de negócio em widgets
□ ListView.builder para listas longas (NUNCA Column)
□ Offline graceful (quando aplicável)
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

---

**Gerado por Architect v3.0**
`;
}
