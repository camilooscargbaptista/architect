import { TemplateContext, EnrichedTemplateContext } from '../../types.js';
import { crossRef, depthIndicator, depthAtLeast, getEnriched, frameworkBadge, frameworkModuleStructure, frameworkSecurityChecklist, toolchainCommands, projectStructureBadge } from '../template-helpers.js';

/**
 * Generates all specialist agent cards.
 * Each is stack-aware and enterprise-grade detailed.
 *
 * All functions support both TemplateContext (backward compat) and EnrichedTemplateContext.
 * Use getEnriched() to safely extract enriched fields when available.
 */

export function generateBackendAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { stack, projectName, config, report } = ctx;
  const enriched = getEnriched(ctx);
  const lang = stack.primary;
  // v3.1: Use detected primary framework instead of generic stack.frameworks
  const primaryFw = enriched.primaryFramework;
  const fw = primaryFw ? primaryFw.name : (stack.frameworks.filter(f =>
    ['Django', 'Flask', 'FastAPI', 'NestJS', 'Spring', 'Express', 'Fastify', 'Rails', 'Laravel'].includes(f)
  ).join(', ') || lang);

  // Build module structure section if enriched data available
  const modulesSection = enriched.modules && enriched.modules.length > 0
    ? `
## Módulos do Projeto

${enriched.modules.map(m => `### ${m.name}
- **Path:** \`${m.path}\`
- **Arquivos:** ${m.fileCount}${m.lineCount > 0 ? ` · **Linhas:** ${m.lineCount.toLocaleString()}` : ''}
- **Descrição:** ${m.description}
- **Testes:** ${m.hasTests ? '✅ Sim' : '❌ Não'}
${m.entities.length > 0 ? `- **Entidades:** ${m.entities.join(', ')}` : ''}
`).join('\n')}
`
    : '';

  // Build endpoints section if enriched data available
  const endpointsSection = enriched.endpoints && enriched.endpoints.length > 0
    ? `
## Endpoints Mapeados

${enriched.endpoints.map(e => `- \`${e.method}\` \`${e.path}\` — ${e.handler} (Auth: ${e.hasAuth ? 'sim' : 'não'}, Validação: ${e.hasValidation ? 'sim' : 'não'})`).join('\n')}
`
    : '';

  // Build domain section if enriched data available
  const domainSection = enriched.domain
    ? `
## Domínio & Contexto de Negócio

- **Domínio:** ${enriched.domain.domain}
- **Sub-domínio:** ${enriched.domain.subDomain}
- **Descrição:** ${enriched.domain.description}
- **Confiança na Inferência:** ${Math.round(enriched.domain.confidence * 100)}%
${enriched.domain.businessEntities && enriched.domain.businessEntities.length > 0
  ? `
### Entidades de Negócio Detectadas

${enriched.domain.businessEntities.map(e => `- **${e.name}** (${e.layer}) — de \`${e.source}\`
  - Campos: ${e.fields.join(', ')}
  - Relacionamentos: ${e.relationships.length > 0 ? e.relationships.join(', ') : 'nenhum'}`).join('\n')}
`
  : ''}
`
    : '';

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

${depthIndicator(ctx)}

> Especialista em backend ${fw} para ${projectName}

## Stack

- **Linguagem:** ${lang}
- **Framework:** ${fw}${primaryFw?.version ? ` v${primaryFw.version}` : ''}
- **Arquitetura:** ${projectStructureBadge(ctx)}
- **Teste:** ${stack.testFramework}
- **Package Manager:** ${stack.packageManager}
- **Score Atual:** ${report.score.overall}/100

${frameworkBadge(ctx)}
${domainSection}

## Princípios (SOLID + Clean Architecture)

1. **S** — Single Responsibility: Uma classe, uma responsabilidade
2. **O** — Open/Closed: Aberto para extensão, fechado para modificação
3. **L** — Liskov Substitution: Subtipos devem ser substituíveis
4. **I** — Interface Segregation: Interfaces específicas > interfaces gordas
5. **D** — Dependency Inversion: Depender de abstrações, não de concretos
${modulesSection}

## Estrutura do Projeto (Detectada)

${frameworkModuleStructure(ctx)}
${endpointsSection}

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

${crossRef('backend', ctx)}

---

**Gerado por Architect v3.0**
`;
}

export function generateFrontendAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { stack, projectName, config, report } = ctx;
  const enriched = getEnriched(ctx);
  const fw = stack.frameworks.find(f =>
    ['Angular', 'Vue', 'Next.js', 'React'].includes(f)) || 'Frontend';

  // Build endpoints integration guide if available
  const endpointsGuide = enriched.endpoints && enriched.endpoints.length > 0
    ? `
## Endpoints para Integração

${enriched.endpoints.filter(e => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(e.method))
  .slice(0, 15) // limit to 15 most important
  .map(e => `- \`${e.method}\` \`${e.path}\` (${e.handler})`)
  .join('\n')}
${enriched.endpoints.length > 15 ? `
... e mais ${enriched.endpoints.length - 15} endpoints. Ver documento de integração completo.` : ''}
`
    : '';

  // Build modules structure if available
  const modulesGuide = enriched.modules && enriched.modules.length > 0
    ? `
## Estrutura de Módulos Disponíveis

${enriched.modules.map(m => `- \`${m.path}\` — ${m.description}`).join('\n')}
`
    : '';

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

${depthIndicator(ctx)}

> Especialista em frontend ${fw} para ${projectName}

## Stack Frontend

- **Framework:** ${fw}
- **Linguagens:** ${stack.languages.join(', ')}
- **Teste:** ${stack.testFramework}
- **Score Atual:** ${report.score.overall}/100

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
${modulesGuide}${endpointsGuide}

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

${crossRef('frontend', ctx)}

---

**Gerado por Architect v3.0**
`;
}

export function generateSecurityAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { projectName, config, stack } = ctx;
  const enriched = getEnriched(ctx);

  // Build compliance section if available
  const complianceSection = enriched.domain && enriched.domain.compliance && enriched.domain.compliance.length > 0
    ? `
## Requisitos de Compliance Detectados

${enriched.domain.compliance.map(c => `### ${c.name}
**Motivo:** ${c.reason}

**Verificações Obrigatórias:**
${c.mandatoryChecks.map(check => `- □ ${check}`).join('\n')}
`).join('\n')}
`
    : '';

  // Build integrations security section if available
  const integrationsSection = enriched.domain && enriched.domain.integrations && enriched.domain.integrations.length > 0
    ? `
## Segurança em Integrações

${enriched.domain.integrations.map(i => {
  let threat = '';
  if (i.type === 'payment') threat = 'PCI-DSS, criptografia de dados sensíveis, tokenização';
  else if (i.type === 'auth') threat = 'MFA, session hijacking, credential stuffing';
  else if (i.type === 'api') threat = 'Rate limiting, API key rotation, HTTPS obrigatório';
  else if (i.type === 'database') threat = 'SQL Injection, Encryption at rest, Backups';
  else if (i.type === 'government') threat = 'Compliance regulatório, audit trails, data retention';
  else threat = 'Validação de entrada/saída, rate limiting';

  return `- **${i.name}** (${i.type}) — Ameaças: ${threat}`;
}).join('\n')}
`
    : '';

  // Domain-specific threats
  const domainThreatsSection = enriched.domain
    ? `
## Ameaças Específicas do Domínio: ${enriched.domain.domain}

${enriched.domain.domain === 'fintech' || enriched.domain.domain === 'payments'
  ? `- **Manipulação de dados:** Auditoria de transações, checksums, criptografia
- **Acesso não autorizado:** MFA em contas privilégiadas, IP whitelist
- **Conformidade:** PCI-DSS, LGPD, SOX
- **Fraude:** Detecção de anomalias, rate limiting`
  : enriched.domain.domain === 'healthtech'
  ? `- **Vazamento de dados:** Criptografia end-to-end, anonimização
- **HIPAA/LGPD:** Audit trails, consentimento explícito
- **Integridade:** Assinatura digital, blockchain se aplicável
- **Acesso:** RBAC granular, 2FA para dados sensíveis`
  : enriched.domain.domain === 'e-commerce'
  ? `- **Fraude de pagamento:** CVV validation, 3D Secure
- **Roubo de dados:** SSL/TLS, PCI-DSS, criptografia em repouso
- **DoS:** Rate limiting, CAPTCHA, WAF
- **Autenticação:** MFA, session timeout`
  : `- **Confidencialidade:** Dados em trânsito e repouso criptografados
- **Integridade:** Validação de entrada, checksums
- **Disponibilidade:** Backup, disaster recovery, monitoring
- **Auditoria:** Logging de ações sensíveis, retention policy`}
`
    : '';

  // v3.1: Framework-specific security checklist
  const stackSecuritySection = frameworkSecurityChecklist(ctx);

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

${depthIndicator(ctx)}

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
${stackSecuritySection}
${complianceSection}${integrationsSection}${domainThreatsSection}

## Quando Ativar

- Qualquer feature que lida com: autenticação, autorização, dados pessoais, pagamentos
- Novas APIs públicas
- Integrações com sistemas externos
- Mudanças em infra/deploy

## Output Esperado

1. Lista de findings com severidade (CRITICAL/HIGH/MEDIUM/LOW)
2. Recomendações de mitigação
3. Threat model (se aplicável)

${crossRef('security-auditor', ctx)}

---

**Gerado por Architect v3.0**
`;
}

export function generateQAAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { projectName, config, stack, plan } = ctx;
  const enriched = getEnriched(ctx);

  // Build untested modules warning (reference canonical source)
  const untestedCount = enriched.untestedModules?.length || 0;
  const unterstedWarning = untestedCount > 0
    ? `
## ⚠️ MÓDULOS SEM COBERTURA DE TESTE

**${untestedCount} módulos sem testes detectados.**

> 📋 Lista completa e priorização: ver [QUALITY-GATES.md](../guards/QUALITY-GATES.md) e [TECH-DEBT-CONTROLLER.md](./TECH-DEBT-CONTROLLER.md)

**Ação:** Implementar testes para cada módulo listado, seguindo o workflow TDD.
`
    : '';

  // Build test scenarios from endpoints
  const testScenariosSection = enriched.endpoints && enriched.endpoints.length > 0
    ? `
## Cenários de Teste por Endpoint

${enriched.endpoints.slice(0, 10).map(e => `### \`${e.method}\` \`${e.path}\`

**Casos de teste:**
- ✅ Sucesso com dados válidos
- ⚠️ Validação: entrada inválida
${e.hasAuth ? `- 🔒 Autenticação: sem token, token inválido
- 🔒 Autorização: usuário sem permissão` : ''}
- ❌ Erro: recurso não encontrado (404)
- ❌ Erro: conflito (409)
`).join('\n')}

${enriched.endpoints.length > 10 ? `... e mais ${enriched.endpoints.length - 10} endpoints para testar.` : ''}
`
    : '';

  // Build domain-specific test scenarios
  const domainTestsSection = enriched.domain
    ? `
## Cenários de Teste Específicos do Domínio: ${enriched.domain.domain}

${enriched.domain.domain === 'fintech' || enriched.domain.domain === 'payments'
  ? `### Testes de Negócio
- Criar transação com valores válidos
- Rejeitar transação acima do limite
- Processar reembolso corretamente
- Auditoria de todas as transações
- Validar saldo após múltiplas operações

### Testes de Segurança
- Não expor dados de cartão em logs
- Validar PCI-DSS compliance
- Testar detecção de fraude`
  : enriched.domain.domain === 'healthtech'
  ? `### Testes de Negócio
- Criar registro de paciente com LGPD compliance
- Validar consentimento antes de compartilhar dados
- Anonimizar dados corretamente
- Respeitar direito ao esquecimento
- Auditoria de acesso a dados sensíveis

### Testes de Segurança
- Criptografia end-to-end em repouso
- Validar 2FA para dados críticos
- Testar retenção de dados`
  : enriched.domain.domain === 'e-commerce'
  ? `### Testes de Negócio
- Criar carrinho com múltiplos produtos
- Aplicar desconto/cupom corretamente
- Processar pagamento com validação 3DS
- Atualizar inventário após venda
- Gerar pedido com status correto

### Testes de Segurança
- Não expor dados de cartão
- Validar rate limiting em checkout
- Testar proteção contra fraud`
  : `### Testes de Negócio
- Fluxo principal (happy path)
- Edge cases e limites
- Concorrência (race conditions)
- Rollback após erro
- Idempotência

### Testes de Segurança
- Inputs inválidos/maliciosos
- Acesso não autorizado
- Rate limiting
- Logging correto`}
`
    : '';

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

${depthIndicator(ctx)}

> Qualidade de testes para ${projectName}

## Metas Inegociáveis

\`\`\`
╔══════════════════════════════════════════╗
║  Cobertura mínima: ${config.coverageMinimum}%                ║
║  Sem testes, sem entrega, sem finalizar  ║
║  INEGOCIÁVEL.                            ║
╚══════════════════════════════════════════╝
\`\`\`
${unterstedWarning}

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
${testScenariosSection}${domainTestsSection}

## Refactoring Roadmap

${plan.steps.slice(0, 5).map((step, idx) => `${idx + 1}. ${step.description} (${step.priority || 'MEDIUM'})`).join('\n')}
${plan.steps.length > 5 ? `\n... e mais ${plan.steps.length - 5} steps.` : ''}

${crossRef('qa-test', ctx)}

---

**Gerado por Architect v3.0**
`;
}

export function generateTechDebtAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { projectName, report, plan, config } = ctx;
  const enriched = getEnriched(ctx);

  // Group anti-patterns by severity
  const criticalPatterns = report.antiPatterns.filter(a => a.severity === 'CRITICAL');
  const highPatterns = report.antiPatterns.filter(a => a.severity === 'HIGH');
  const mediumPatterns = report.antiPatterns.filter(a => a.severity === 'MEDIUM');
  const lowPatterns = report.antiPatterns.filter(a => a.severity === 'LOW');

  const antiPatternsSection = `
## Anti-Patterns Detectados (Agrupados por Severidade)

${criticalPatterns.length > 0 ? `
### 🔴 CRÍTICOS (${criticalPatterns.length})
${criticalPatterns.map(a => `- **${a.name}** — \`${a.location}\`
  Ação: Resolver no próximo sprint`).join('\n')}
` : ''}

${highPatterns.length > 0 ? `
### 🟠 ALTOS (${highPatterns.length})
${highPatterns.map(a => `- **${a.name}** — \`${a.location}\`
  Ação: Planejar correção para próximas 2 semanas`).join('\n')}
` : ''}

${mediumPatterns.length > 0 ? `
### 🟡 MÉDIOS (${mediumPatterns.length})
${mediumPatterns.map(a => `- **${a.name}** — \`${a.location}\`
  Ação: Adicionar ao backlog de técnico`).join('\n')}
` : ''}

${lowPatterns.length > 0 ? `
### 🟢 BAIXOS (${lowPatterns.length})
${lowPatterns.map(a => `- **${a.name}** — \`${a.location}\`
  Ação: Considerar em refatorações futuras`).join('\n')}
` : ''}

${report.antiPatterns.length === 0 ? '✅ Nenhum anti-pattern detectado.' : ''}
`;

  // Critical coupling hotspots
  const couplingSection = enriched.criticalPaths && enriched.criticalPaths.length > 0
    ? `
## Hotspots de Acoplamento (Tech Debt)

Arquivos com alta complexidade de acoplamento — priorizar refatoração:

${enriched.criticalPaths.slice(0, 10).map(p => `- \`${p}\` — Alto acoplamento detectado`).join('\n')}
${enriched.criticalPaths.length > 10 ? `\n... e mais ${enriched.criticalPaths.length - 10} caminhos críticos.` : ''}
`
    : '';

  // Untested modules as debt (reference canonical source)
  const untestedDebtCount = enriched.untestedModules?.length || 0;
  const unterstedDebtSection = untestedDebtCount > 0
    ? `
## Débito em Cobertura de Teste

**${untestedDebtCount} módulos sem testes adequados detectados.**

> 📋 Lista canônica e gates de cobertura: ver [QUALITY-GATES.md](../guards/QUALITY-GATES.md#módulos-sem-testes)

**Plano de ação:**
1. Priorizar módulos com mais dependências
2. Seguir workflow TDD para cada módulo
3. Meta: reduzir lista a zero em ${Math.ceil(untestedDebtCount / 3)} sprints
`
    : '';

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

${depthIndicator(ctx)}

> Controle de débito técnico para ${projectName}

## Estado Atual

| Métrica | Valor |
|---------|-------|
| Score | ${report.score.overall}/100 |
| Meta | ${Math.min(100, report.score.overall + 10)}/100 |
| Anti-patterns | ${report.antiPatterns.length} |
| Refatorações pendentes | ${plan.steps.length} |
| Estimativa de Melhora | +${plan.estimatedScoreAfter.overall - report.score.overall} pontos |
${antiPatternsSection}${couplingSection}${unterstedDebtSection}

## Roadmap de Refatoração

Prioridade por impacto:

${plan.steps.slice(0, 8).map((step, idx) => `
${idx + 1}. **${step.title}** — ${step.description}
   - Tier: ${step.tier === 1 ? 'Crítico' : 'Importante'}
   - Prioridade: ${step.priority}
`).join('\n')}

${plan.steps.length > 8 ? `
... e mais ${plan.steps.length - 8} steps no plano completo.
` : ''}

## Metas de Score

\`\`\`
Score Atual:            ${report.score.overall}/100
Meta Curto Prazo:       ${Math.min(100, report.score.overall + 5)}/100
Meta Médio Prazo:       ${Math.min(100, report.score.overall + 10)}/100
Mínimo Aceitável:       ${config.scoreThreshold}/100
\`\`\`

## Regras

\`\`\`
□ Score NUNCA pode regredir após um PR
□ Mínimo: ${config.scoreThreshold}/100
□ Críticos: resolver dentro de 1 sprint
□ Altos: resolver dentro de 2 sprints
□ Médios: adicionar ao backlog técnico
□ Verificar com: architect score ./src
\`\`\`

${crossRef('tech-debt', ctx)}

---

**Gerado por Architect v3.0**
`;
}

export function generateCodeReviewChecklist(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { projectName, config, stack } = ctx;
  const enriched = getEnriched(ctx);

  // Domain-specific review items
  const domainReviewItems = enriched.domain
    ? `
## Itens de Revisão Específicos do Domínio: ${enriched.domain.domain}

${enriched.domain.domain === 'fintech' || enriched.domain.domain === 'payments'
  ? `□ Transações são idempotentes?
□ Auditoria completa de todas as operações?
□ Sem exposição de dados sensíveis em logs?
□ Valores monetários não usam float (usar Decimal)?
□ PCI-DSS compliance verificado?`
  : enriched.domain.domain === 'healthtech'
  ? `□ LGPD compliance verificado (consentimento, retenção)?
□ Dados sensíveis criptografados em repouso?
□ Acesso auditado e logado?
□ Anonimização implementada corretamente?
□ 2FA em operações sensíveis?`
  : enriched.domain.domain === 'e-commerce'
  ? `□ Carrinho é idempotente?
□ Inventário é atualizado corretamente (race conditions)?
□ Preços são validados (sem manipulação client-side)?
□ Cupons/descontos aplicados corretamente?
□ Fraude detection implementado?`
  : `□ Fluxo crítico de negócio não quebrou?
□ Rollback é seguro?
□ Concorrência tratada?
□ State final é consistente?`}
`
    : '';

  // Stack-specific review items
  const stackReviewItems = `
## Checklist Específico para ${stack.primary}

${stack.primary === 'TypeScript' || stack.primary === 'JavaScript'
  ? `□ \`strict: true\` em tsconfig (sem any sem justificativa)?
□ Imports circulares?
□ Async/await tratado (sem unhandled promises)?
□ Memory leaks (EventListeners desinscritos)?
□ Console.log/debugger removidos?`
  : stack.primary === 'Python'
  ? `□ Type hints em todas as funções públicas?
□ Docstrings formatadas (Google ou NumPy style)?
□ Sem mutable default arguments?
□ Context managers usados para resources?
□ F-strings em vez de % ou .format()?
□ Sem \`eval()\` ou \`exec()\`?`
  : stack.primary === 'Go'
  ? `□ Erros tratados (não ignorados com _)?
□ Defer para cleanup?
□ Goroutines com contexto?
□ Race conditions testadas?
□ Timeouts implementados?`
  : stack.primary === 'Dart'
  ? `□ Null-safety (! evitado)?
□ Widgets têm keys quando em listas?
□ BuildContext acessado apenas em build?
□ Listeners desinscritos?
□ Imagens/assets fazem lazy-load?`
  : `□ Código segue padrões do projeto?
□ Dependencies atualizadas?
□ Sem warnings do compilador/linter?`}
`;

  // Integration/endpoint specific items
  const integrationReviewItems = enriched.endpoints && enriched.endpoints.length > 0
    ? `
## Itens de Revisão de Integração

□ Endpoint trata todos os status codes esperados?
□ Validação do payload de entrada?
${enriched.endpoints.some(e => e.hasAuth) ? '□ Autenticação/autorização verificadas?' : ''}
${enriched.endpoints.some(e => e.hasValidation) ? '□ Validação de input implementada?' : ''}
□ Resposta segue o contrato documentado?
□ Erros retornam mensagens claras?
□ Rate limiting aplicado?
□ Logging estruturado?
`
    : '';

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Code Review Checklist — Pontos obrigatórios de revisão'
---

# 🔍 CODE REVIEW CHECKLIST — ${projectName}

${depthIndicator(ctx)}

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
${stackReviewItems}${domainReviewItems}${integrationReviewItems}

${crossRef('code-review', ctx)}

---

**Gerado por Architect v3.0**
`;
}

export function generateDatabaseAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { projectName, config, stack } = ctx;
  const enriched = getEnriched(ctx);

  // Detect ORM/database framework
  const dbFramework = stack.frameworks.filter(f =>
    ['TypeORM', 'Prisma', 'SQLAlchemy', 'Django ORM', 'Sequelize', 'Knex'].includes(f)
  ).join(', ') || 'SQL';

  // Build business entities section
  const entitiesSection = enriched.domain && enriched.domain.businessEntities && enriched.domain.businessEntities.length > 0
    ? `
## Entidades de Negócio (Entity Relationship)

${enriched.domain.businessEntities.map(e => `
### ${e.name}
**Camada:** ${e.layer} | **Fonte:** \`${e.source}\`

**Campos:**
${e.fields.map(f => `- ${f}`).join('\n')}

**Relacionamentos:**
${e.relationships.length > 0 ? e.relationships.map(r => `- ${r}`).join('\n') : '- Nenhum'}
`).join('\n')}
`
    : '';

  // Migration strategy based on framework
  const migrationStrategy = `
## Estratégia de Migrations

### Framework: ${dbFramework}

${dbFramework.includes('TypeORM')
  ? `\`\`\`bash
# Criar migration
npm run typeorm migration:generate -- -n DescricaoDaMigracao

# Executar
npm run typeorm migration:run

# Reverter
npm run typeorm migration:revert
\`\`\`

**Padrão:**
- Uma migration por feature
- Naming: \`YYYY-MM-DD-HH-mm-ss-description.ts\`
- Ambos up() e down() implementados
- Testar reverter em staging antes de produção`
  : dbFramework.includes('Prisma')
  ? `\`\`\`bash
# Criar migration
npx prisma migrate dev --name DescricaoDaMigracao

# Produção
npx prisma migrate deploy
\`\`\`

**Padrão:**
- Schema.prisma é source of truth
- Migrations em \`prisma/migrations/\`
- Sempre testar \`prisma migrate resolve\` se houver problema
- Usar \`@relation\` para relacionamentos`
  : dbFramework.includes('SQLAlchemy')
  ? `\`\`\`bash
# Criar migration
alembic revision --autogenerate -m "description"

# Executar
alembic upgrade head

# Reverter
alembic downgrade -1
\`\`\`

**Padrão:**
- Alembic em \`alembic/versions/\`
- Sempre revisar .py autogenerado
- Testar em staging antes de produção`
  : `\`\`\`bash
# Criar arquivos .sql com:
-- migrations/001-create-table.up.sql
-- migrations/001-create-table.down.sql
\`\`\`

**Padrão:**
- Um arquivo up/down por migration
- Idempotent (IF NOT EXISTS, etc.)
- Testar reverter`}
`;

  // Indexing strategy
  const indexingStrategy = `
## Estratégia de Indexing

### Índices Obrigatórios:

\`\`\`
□ PRIMARY KEY em toda tabela
□ FOREIGN KEYS entre entidades relacionadas
□ Índice em campos usados em WHERE frequente
□ Índice em campos de JOIN
□ Índice em campos de ORDER BY
\`\`\`

### Exemplo:

\`\`\`sql
-- Por frequência de query
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_order_user_id ON orders(user_id);
CREATE INDEX idx_order_status_created ON orders(status, created_at);

-- Composto para filtros múltiplos
CREATE INDEX idx_order_user_status ON orders(user_id, status);
\`\`\`

### Cuidado:

\`\`\`
□ Não criar índice para CADA coluna (overhead)
□ Medir com EXPLAIN PLAN antes/depois
□ Índices consomem storage e memória
□ Atualizar índices em ALTER TABLE é lento
\`\`\`
`;

  // Build domain patterns section with conditional content
  let domainPatternsContent = '';
  if (enriched.domain) {
    if (enriched.domain.domain === 'fintech' || enriched.domain.domain === 'payments') {
      domainPatternsContent = `### Requisitos:
- **Audit Trail:** TODA transação registrada com timestamp/user
- **Soft Deletes:** Nunca deletar, marcar como inativo
- **Idempotência:** Transação com mesmo ID é processada 1x
- **Timestamps:** created_at, updated_at, deleted_at em todas as tabelas
- **Denormalização:** Guardar valor em repouso na transação

### Exemplo Schema:
\`\`\`sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(19,2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- PENDING, COMPLETED, FAILED
  idempotency_key VARCHAR(255) UNIQUE, -- para replay-safety
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE transaction_audit (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id),
  action VARCHAR(50),
  user_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\``;
    } else if (enriched.domain.domain === 'healthtech') {
      domainPatternsContent = `### Requisitos:
- **Criptografia:** Dados sensíveis criptografados em repouso
- **Anonimização:** Poder remover PII mantendo histórico
- **Retention:** Política de retenção de dados
- **Access Logs:** Quem acessou o que, quando
- **Consentimento:** Rastrear consentimento de paciente

### Exemplo Schema:
\`\`\`sql
CREATE TABLE patients (
  id UUID PRIMARY KEY,
  name_encrypted BYTEA NOT NULL, -- criptografado
  ssn_encrypted BYTEA NOT NULL,
  created_at TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE access_logs (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  accessed_by UUID REFERENCES users(id),
  accessed_at TIMESTAMP,
  data_type VARCHAR(50),
  purpose VARCHAR(100)
);

CREATE TABLE consents (
  id UUID PRIMARY KEY,
  patient_id UUID REFERENCES patients(id),
  type VARCHAR(50),
  granted_at TIMESTAMP,
  expires_at TIMESTAMP
);
\`\`\``;
    } else if (enriched.domain.domain === 'e-commerce') {
      domainPatternsContent = `### Requisitos:
- **Inventário:** Stock é crítico (race condition)
- **Preços:** Histórico de preço por produto
- **Pedidos:** Snapshot do preço no momento da venda
- **Cupons:** Validação e uso limitado
- **Pagamento:** Separado de pedido (pode estar pendente)

### Exemplo Schema:
\`\`\`sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  price DECIMAL(19,2), -- preço atual
  stock INT DEFAULT 0
);

CREATE TABLE product_prices (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  price DECIMAL(19,2),
  effective_from TIMESTAMP,
  effective_to TIMESTAMP NULL
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  total DECIMAL(19,2),
  status VARCHAR(20),
  created_at TIMESTAMP
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INT,
  price_at_purchase DECIMAL(19,2) -- snapshot
);
\`\`\``;
    } else {
      domainPatternsContent = `### Requisitos Genéricos:
- Timestamps: created_at, updated_at
- Soft deletes: deleted_at (se aplicável)
- Índices em ForeignKeys
- Constraints em integridade`;
    }
  }

  const domainPatternsSection = enriched.domain
    ? `
## Padrões de Dados Específicos do Domínio: ${enriched.domain.domain}

${domainPatternsContent}
`
    : '';

  // Compliance section
  const complianceSection = enriched.domain && enriched.domain.compliance && enriched.domain.compliance.length > 0
    ? `
## Compliance & Dados

${enriched.domain.compliance.map(c => `### ${c.name}
${c.mandatoryChecks.map(check => `- □ ${check}`).join('\n')}
`).join('\n')}
`
    : '';

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

${depthIndicator(ctx)}

> Schema design, migrations, e performance para ${projectName}
${entitiesSection}${migrationStrategy}${indexingStrategy}${domainPatternsSection}${complianceSection}

## Regras Gerais

\`\`\`
□ TODA migration deve ser reversível (up + down)
□ Índices para queries frequentes (validar com EXPLAIN)
□ Foreign keys onde há relacionamento
□ Constraints (NOT NULL, UNIQUE, CHECK) por negócio
□ Sem ALTER TABLE em tabelas grandes sem plano
□ Seed data atualizado para dev/test
□ Queries otimizadas (sem N+1, sem full scan)
□ Performance de migrations testada em staging
\`\`\`

${crossRef('database-engineer', ctx)}

---

**Gerado por Architect v3.0**
`;
}

export function generateMobileAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { projectName, config, stack } = ctx;
  const enriched = getEnriched(ctx);

  // Build endpoints for mobile integration
  const endpointsSection = enriched.endpoints && enriched.endpoints.length > 0
    ? `
## Endpoints para Integração Mobile

${enriched.endpoints.slice(0, 12).map(e => `- \`${e.method}\` \`${e.path}\` — ${e.handler}`).join('\n')}
${enriched.endpoints.length > 12 ? `\n... e mais ${enriched.endpoints.length - 12} endpoints. Ver documento de integração.` : ''}
`
    : '';

  // Build modules structure
  const modulesSection = enriched.modules && enriched.modules.length > 0
    ? `
## Estrutura de Módulos

${enriched.modules.map(m => `- \`${m.path}\` — ${m.description}`).join('\n')}
`
    : '';

  // Build domain-specific mobile considerations
  let domainMobileContent = '';
  if (enriched.domain) {
    if (enriched.domain.domain === 'fintech' || enriched.domain.domain === 'payments') {
      domainMobileContent = `### Screens Críticas:
- **Carteira:** Saldo disponível, histórico de transações
- **Enviar Dinheiro:** Validação de conta destino, confirmação
- **Pagamentos:** 2FA, biometria, confirmação final
- **Segurança:** Definir PIN, mudar senha, 2FA setup

### Estados Especiais:
- Offline: Mostrar saldo em cache, desabilitar transações
- Sincronizando: Indicator de atualização
- Erro de rede: Retry com backoff exponencial
- Transação pendente: Status em tempo real`;
    } else if (enriched.domain.domain === 'healthtech') {
      domainMobileContent = `### Screens Críticas:
- **Prontuário:** Histórico médico, medicações
- **Agendamento:** Calendário, confirmação SMS
- **Consulta:** Receitas, encaminhamentos
- **Privacidade:** Consentimento, biometria

### Estados Especiais:
- Offline: Dados sincronizam quando online
- Dados sensíveis: Sempre requer biometria
- Consulta em andamento: Status em tempo real
- Privacidade: Diálogos de consentimento antes de acessar`;
    } else if (enriched.domain.domain === 'e-commerce') {
      domainMobileContent = `### Screens Críticas:
- **Catálogo:** Filtros, busca, avaliações
- **Carrinho:** Quantidade, preço atualizado, cupom
- **Checkout:** Endereço, cartão, 3D Secure
- **Pedidos:** Status, rastreamento, devolução

### Estados Especiais:
- Offline: Carrinho em cache, sincroniza depois
- Estoque zerado: Mostrar de forma clara
- Frete: Calcular por CEP em tempo real
- Promoção: Aplicar cupom com feedback imediato`;
    } else {
      domainMobileContent = `### Screens Padrão:
- Lista: Com busca, filtro, paginação
- Detalhe: Completo com ações
- Formulário: Validação em tempo real
- Confirmação: Antes de ação crítica

### Estados Especiais:
- Loading: Skeleton ou spinner
- Empty: Mensagem clara
- Error: Com retry
- Offline: Modo read-only`;
    }
  }

  const domainSection = enriched.domain
    ? `
## Considerações de UX por Domínio: ${enriched.domain.domain}

${domainMobileContent}
`
    : '';

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

${depthIndicator(ctx)}

> Screens mobile, widgets, navegação para ${projectName}

## Stack

- **Framework:** Flutter / Dart
- **Package Manager:** ${stack.packageManager}
- **Teste:** ${stack.testFramework}

## Pré-Requisitos

\`\`\`
□ MOCKUP do app aprovado (com todos os estados e fluxos)
□ Documento de Integração disponível
□ User stories com critérios de aceite
□ Design system aprovado (cores, tipografia, componentes)
\`\`\`
${modulesSection}${endpointsSection}${domainSection}

## Regras

\`\`\`
□ TODOS os estados: normal, loading, error, empty
□ Padrão visual do app (cores, fontes, espaçamentos) consistente
□ Navegação consistente (back button, deep link funcionando)
□ Sem lógica de negócio em widgets (usar ChangeNotifier/Bloc)
□ ListView.builder para listas longas (NUNCA Column com itens dinâmicos)
□ Offline graceful quando aplicável (cache local)
□ Imagens com lazy-load e placeholder
□ Screens responsivas (testar orientação portrait + landscape)
□ Acessibilidade (Semantics, labels)
□ Cobertura ≥ ${config.coverageMinimum}%
\`\`\`

## Estrutura de Projeto

\`\`\`
lib/
├── main.dart
├── models/
│   └── [domain].dart
├── screens/
│   └── [feature]/
│       ├── [feature]_screen.dart
│       └── widgets/
│           └── [component].dart
├── services/
│   └── api_service.dart
└── __tests__/
    └── [feature]_test.dart
\`\`\`

${crossRef('flutter', ctx)}

---

**Gerado por Architect v3.0**
`;
}
