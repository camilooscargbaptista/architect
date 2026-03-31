import { TemplateContext, EnrichedTemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';
    // @ts-ignore - Audit cleanup unused variable
import { crossRef, depthIndicator, depthAtLeast, getEnriched, frameworkBadge, frameworkModuleStructure, frameworkSecurityChecklist, toolchainCommands, projectStructureBadge } from '../template-helpers.js';

/**
 * Generates all specialist agent cards.
 * Each is stack-aware and enterprise-grade detailed.
 *
 * All functions support both TemplateContext (backward compat) and EnrichedTemplateContext.
 * Use getEnriched() to safely extract enriched fields when available.
 */

import { i18n } from '@girardelli/architect-core/src/core/i18n.js';

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
## ${i18n.t('agents.backend.modules')}

${enriched.modules.map(m => `### ${m.name}
- **Path:** \`${m.path}\`
- **${i18n.t('cli.results.files')}:** ${m.fileCount}${m.lineCount > 0 ? ` · **${i18n.t('cli.results.lines')}:** ${m.lineCount.toLocaleString()}` : ''}
- **Descrição:** ${m.description}
- **Testes:** ${m.hasTests ? '✅ ' + i18n.t('common.yes') : '❌ ' + i18n.t('common.no')}
${m.entities.length > 0 ? `- **Entidades:** ${m.entities.join(', ')}` : ''}
`).join('\n')}
`
    : '';

  // Build endpoints section if enriched data available
  const endpointsSection = enriched.endpoints && enriched.endpoints.length > 0
    ? `
## ${i18n.t('enriched.endpoints')}

${enriched.endpoints.map(e => `- \`${e.method}\` \`${e.path}\` — ${e.handler} (Auth: ${e.hasAuth ? i18n.t('common.yes') : i18n.t('common.no')}, Validação: ${e.hasValidation ? i18n.t('common.yes') : i18n.t('common.no')})`).join('\n')}
`
    : '';

  // Build domain section if enriched data available
  const domainSection = enriched.domain
    ? `
## ${i18n.t('agents.backend.domainContext')}

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
  description: '${i18n.t('agents.backend.description', { lang })}'
agent_card:
  id: '${lang.toLowerCase()}-backend'
  name: '${lang} Backend Developer'
  role: 'development'
  capabilities: [api-design, service-architecture, business-logic, data-modeling, testing]
  inputs: [user-story, api-contracts, business-rules, integration-doc]
  outputs: [controllers, services, entities, migrations, tests, integration-doc]
  depends_on: [${stack.hasDatabase ? 'database-engineer' : ''}]
version: 3.1.0
---

# ${i18n.t('agents.backend.title', { lang: lang.toUpperCase() })}

${depthIndicator(ctx)}

> ${i18n.t('agents.backend.specialistIn', { fw, projectName })}

## ${i18n.t('agents.backend.stack')}

- **${i18n.t('agents.backend.language')}:** ${lang}
- **${i18n.t('agents.backend.framework')}:** ${fw}${primaryFw?.version ? ` v${primaryFw.version}` : ''}
- **${i18n.t('agents.backend.architecture')}:** ${projectStructureBadge(ctx)}
- **${i18n.t('agents.backend.test')}:** ${stack.testFramework}
- **${i18n.t('agents.backend.packageManager')}:** ${stack.packageManager}
- **${i18n.t('agents.backend.currentScore')}:** ${report.score.overall}/100

${frameworkBadge(ctx)}
${domainSection}

## ${i18n.t('agents.backend.principles')}

1. **S** — Single Responsibility
2. **O** — Open/Closed
3. **L** — Liskov Substitution
4. **I** — Interface Segregation
5. **D** — Dependency Inversion
${modulesSection}

## ${i18n.t('agents.backend.projectStructure')}

${frameworkModuleStructure(ctx)}
${endpointsSection}

## ${i18n.t('agents.backend.implementationRules')}

\`\`\`
${i18n.t('agents.backend.implementationRulesBody', { coverage: config.coverageMinimum })}
\`\`\`

## ${i18n.t('agents.backend.afterImplementation')}

${i18n.t('agents.backend.afterImplementationBody')}

${crossRef('backend', ctx)}

---

**${i18n.t('agents.generatedBy')}**
`;
}

export function generateFrontendAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { stack, projectName, config, report } = ctx;
  const enriched = getEnriched(ctx);
  // v5.1: Use enriched primaryFramework or detect from all frameworks
  const FRONTEND_FWS = ['Angular', 'Vue', 'Vue.js', 'Next.js', 'React', 'Nuxt', 'Svelte', 'Remix'];
  const detectedFw = enriched.detectedFrameworks?.find(f => FRONTEND_FWS.includes(f.name));
  const fw = detectedFw?.name ||
    stack.frameworks.find(f => FRONTEND_FWS.includes(f)) || 'Frontend';

  // Build endpoints integration guide if available
  const endpointsGuide = enriched.endpoints && enriched.endpoints.length > 0
    ? `
## ${i18n.t('enriched.endpoints')}

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
## ${i18n.t('agents.backend.modules')}

${enriched.modules.map(m => `- \`${m.path}\` — ${m.description}`).join('\n')}
`
    : '';

  return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*.{ts,tsx,vue,jsx,html,css,scss}']
  description: '${i18n.t('agents.frontend.description', { fw })}'
agent_card:
  id: '${fw.toLowerCase().replace('.', '')}-frontend'
  name: '${fw} Frontend Developer'
  role: 'development'
  capabilities: [component-development, state-management, responsive-design, form-handling, api-integration]
  inputs: [mockup, integration-doc, user-story, design-system]
  outputs: [components, pages, services, tests]
  depends_on: [orchestrator]
version: 3.1.0
---

# ${i18n.t('agents.frontend.title', { fw: fw.toUpperCase().replace('.', '') })}

${depthIndicator(ctx)}

> ${i18n.t('agents.frontend.specialistIn', { fw, projectName })}

## ${i18n.t('agents.backend.stack')}

- **${i18n.t('agents.backend.framework')}:** ${fw}
- **${i18n.t('agents.backend.language')}s:** ${stack.languages.join(', ')}
- **${i18n.t('agents.backend.test')}:** ${stack.testFramework}
- **${i18n.t('agents.backend.currentScore')}:** ${report.score.overall}/100

## ${i18n.t('agents.frontend.prerequisites')}

\`\`\`
${i18n.t('agents.frontend.prerequisitesBody')}
\`\`\`
${modulesGuide}${endpointsGuide}

## ${i18n.t('agents.frontend.implementationRules')}

\`\`\`
${i18n.t('agents.frontend.implementationRulesBody', { coverage: config.coverageMinimum })}
\`\`\`

${crossRef('frontend', ctx)}

---

**${i18n.t('agents.generatedBy')}**
`;
}

export function generateSecurityAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
    // @ts-ignore - Audit cleanup unused variable
  const { projectName, config, stack } = ctx;
  const enriched = getEnriched(ctx);

  // Build compliance section if available
  const complianceSection = enriched.domain && enriched.domain.compliance && enriched.domain.compliance.length > 0
    ? `
## ${i18n.t('dynamic.compliance.title')}

${enriched.domain.compliance.map(c => `### ${c.name}
**${i18n.t('dynamic.compliance.reason')}:** ${c.reason}

**${i18n.t('dynamic.compliance.mandatoryChecks')}:**
${c.mandatoryChecks.map(check => `- □ ${check}`).join('\n')}
`).join('\n')}
`
    : '';

  // Build integrations security section if available
  const integrationsSection = enriched.domain && enriched.domain.integrations && enriched.domain.integrations.length > 0
    ? `
## ${i18n.t('dynamic.integrations.title')}

${enriched.domain.integrations.map(i => {
  let threat = '';
  if (i.type === 'payment') threat = i18n.t('dynamic.integrations.types.payment');
  else if (i.type === 'auth') threat = i18n.t('dynamic.integrations.types.auth');
  else if (i.type === 'api') threat = i18n.t('dynamic.integrations.types.api');
  else if (i.type === 'database') threat = i18n.t('dynamic.integrations.types.database');
  else if (i.type === 'government') threat = i18n.t('dynamic.integrations.types.government');
  else threat = i18n.t('dynamic.integrations.types.default');

  return `- **${i.name}** (${i.type}) — ${i18n.t('dynamic.integrations.threats')}: ${threat}`;
}).join('\n')}
`
    : '';

  // Domain-specific threats
  const domainThreatsSection = enriched.domain
    ? `
## ${i18n.t('dynamic.domainThreats.title', { domain: enriched.domain.domain })}

${enriched.domain.domain === 'fintech' || enriched.domain.domain === 'payments'
  ? i18n.t('dynamic.domainThreats.fintech')
  : enriched.domain.domain === 'healthtech'
  ? i18n.t('dynamic.domainThreats.healthtech')
  : enriched.domain.domain === 'e-commerce'
  ? i18n.t('dynamic.domainThreats.ecommerce')
  : i18n.t('dynamic.domainThreats.default')}
`
    : '';

  // v3.1: Framework-specific security checklist
  const stackSecuritySection = frameworkSecurityChecklist(ctx);

  return `---
antigravity:
  trigger: 'on_demand'
  description: '${i18n.t('agents.security.description')}'
agent_card:
  id: 'security-auditor'
  name: 'Security Auditor'
  role: 'quality'
  capabilities: [threat-modeling, owasp-analysis, compliance-check, vulnerability-detection]
  inputs: [architecture-doc, source-code, api-contracts]
  outputs: [threat-model, security-findings, compliance-report]
  depends_on: []
version: 3.1.0
---

# ${i18n.t('agents.security.title')}

${depthIndicator(ctx)}

> ${i18n.t('agents.security.analysisFor', { projectName })}

## ${i18n.t('agents.security.checklist')}

\`\`\`
${i18n.t('agents.security.checklistBody')}
\`\`\`
${stackSecuritySection}
${complianceSection}${integrationsSection}${domainThreatsSection}

## ${i18n.t('agents.security.whenToActivate')}

${i18n.t('agents.security.whenToActivateBody')}

## ${i18n.t('agents.security.expectedOutput')}

${i18n.t('agents.security.expectedOutputBody')}

${crossRef('security-auditor', ctx)}

---

**${i18n.t('agents.generatedBy')}**
`;
}

export function generateQAAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
  const { projectName, config, stack, plan } = ctx;
  const enriched = getEnriched(ctx);

  // Build untested modules warning (reference canonical source)
  const untestedCount = enriched.untestedModules?.length || 0;
  const unterstedWarning = untestedCount > 0
    ? `
## ⚠️ ${i18n.t('enriched.untestedModules')}

${i18n.t('enriched.untestedModulesBody', { count: untestedCount })}
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
## ${i18n.t('dynamic.qaDomain.title', { domain: enriched.domain.domain })}

${enriched.domain.domain === 'fintech' || enriched.domain.domain === 'payments'
  ? i18n.t('dynamic.qaDomain.fintech')
  : enriched.domain.domain === 'healthtech'
  ? i18n.t('dynamic.qaDomain.healthtech')
  : enriched.domain.domain === 'e-commerce'
  ? i18n.t('dynamic.qaDomain.ecommerce')
  : i18n.t('dynamic.qaDomain.default')}
`
    : '';

  return `---
antigravity:
  trigger: 'on_demand'
  description: '${i18n.t('agents.qa.description')}'
agent_card:
  id: 'qa-test-engineer'
  name: 'QA Test Engineer'
  role: 'quality'
  capabilities: [test-planning, bdd-scenarios, tdd-implementation, coverage-analysis, regression-testing]
  inputs: [user-story, bdd-scenarios, source-code]
  outputs: [test-plan, test-cases, coverage-report]
  depends_on: []
version: 3.1.0
---

# ${i18n.t('agents.qa.title')}

${depthIndicator(ctx)}

> ${i18n.t('agents.qa.qualityFor', { projectName })}

## ${i18n.t('agents.qa.nonNegotiable')}

\`\`\`
${i18n.t('agents.qa.nonNegotiableBody', { coverage: config.coverageMinimum })}
\`\`\`
${unterstedWarning}

## ${i18n.t('agents.qa.pyramid')}

\`\`\`
${i18n.t('agents.qa.pyramidBody')}
\`\`\`

## ${i18n.t('agents.qa.process')}

${i18n.t('agents.qa.processBody')}

## Framework: ${stack.testFramework}
${testScenariosSection}${domainTestsSection}

## ${i18n.t('agents.qa.refactoringRoadmap')}

${plan.steps.slice(0, 5).map((step, idx) => `${idx + 1}. ${step.description} (${step.priority || 'MEDIUM'})`).join('\n')}
${plan.steps.length > 5 ? `\n... e mais ${plan.steps.length - 5} steps.` : ''}

${crossRef('qa-test', ctx)}

---

**${i18n.t('agents.generatedBy')}**
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
  description: '${i18n.t('agents.techDebt.description')}'
agent_card:
  id: 'tech-debt-controller'
  name: 'Tech Debt Controller'
  role: 'governance'
  capabilities: [debt-tracking, score-monitoring, refactoring-prioritization]
  inputs: [architecture-report, anti-patterns, score-history]
  outputs: [debt-backlog, refactoring-plan, score-targets]
  depends_on: []
version: 3.1.0
---

# ${i18n.t('agents.techDebt.title')}

${depthIndicator(ctx)}

> ${i18n.t('agents.techDebt.controlFor', { projectName })}

## ${i18n.t('agents.techDebt.currentState')}

${i18n.t('agents.techDebt.stateTable', { score: report.score.overall, target: Math.min(100, report.score.overall + 10), antiPatterns: report.antiPatterns.length, refactoringSteps: plan.steps.length, improvement: plan.estimatedScoreAfter.overall - report.score.overall })}
${antiPatternsSection}${couplingSection}${unterstedDebtSection}

## ${i18n.t('agents.techDebt.refactoringRoadmap')}

Prioridade por impacto:

${plan.steps.slice(0, 8).map((step, idx) => `
${idx + 1}. **${step.title}** — ${step.description}
   - Tier: ${step.tier === 1 ? 'Crítico' : 'Importante'}
   - Prioridade: ${step.priority}
`).join('\n')}

${plan.steps.length > 8 ? `
... e mais ${plan.steps.length - 8} steps no plano completo.
` : ''}

## ${i18n.t('agents.techDebt.scoreTargets')}

\`\`\`
${i18n.t('agents.techDebt.scoreTargetsBody', { score: report.score.overall, targetShort: Math.min(100, report.score.overall + 5), targetMedium: Math.min(100, report.score.overall + 10), threshold: config.scoreThreshold })}
\`\`\`

## ${i18n.t('agents.techDebt.rules')}

\`\`\`
${i18n.t('agents.techDebt.rulesBody', { threshold: config.scoreThreshold })}
\`\`\`

${crossRef('tech-debt', ctx)}

---

**${i18n.t('agents.generatedBy')}**
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

**Gerado por Architect v3.1**
`;
}

export function generateDatabaseAgent(ctx: TemplateContext | EnrichedTemplateContext): string {
    // @ts-ignore - Audit cleanup unused variable
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
version: 3.1.0
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

**Gerado por Architect v3.1**
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
version: 3.1.0
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

**Gerado por Architect v3.1**
`;
}
