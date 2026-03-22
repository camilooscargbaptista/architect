import { TemplateContext, EnrichedTemplateContext } from '../types.js';

/**
 * Template Helpers — Utilitários compartilhados por todos os templates.
 *
 * Fornece:
 * - getEnriched(): safe cast para EnrichedTemplateContext
 * - depthScale(): ajusta verbosidade pelo porte do projeto
 * - crossRef(): gera cross-references entre agents
 * - domainBadge(): gera badge de domínio para headers
 * - complianceBadge(): gera badges de compliance
 */

/** Safely extract enriched context fields, returning defaults if not available */
export function getEnriched(ctx: TemplateContext): Partial<EnrichedTemplateContext> {
  if ('domain' in ctx) return ctx as EnrichedTemplateContext;
  return {};
}

/** Check if context is enriched */
export function isEnriched(ctx: TemplateContext): ctx is EnrichedTemplateContext {
  return 'domain' in ctx;
}

/**
 * Depth-based content scaling.
 * Returns content appropriate for the project's depth level.
 *
 * - small: minimal (skip detailed sections)
 * - medium: standard
 * - large: detailed
 * - enterprise: comprehensive (all sections, extra governance)
 */
export function depthScale<T>(
  ctx: TemplateContext,
  options: {
    small: T;
    medium: T;
    large: T;
    enterprise: T;
  },
): T {
  const enriched = getEnriched(ctx);
  const depth = (enriched.projectDepth || 'medium') as 'small' | 'medium' | 'large' | 'enterprise';
  return options[depth];
}

/**
 * Returns true if the current project depth >= the minimum required depth.
 * Useful for conditionally including sections.
 */
export function depthAtLeast(ctx: TemplateContext, minDepth: 'small' | 'medium' | 'large' | 'enterprise'): boolean {
  const enriched = getEnriched(ctx);
  const depth = enriched.projectDepth || 'medium';
  const order = ['small', 'medium', 'large', 'enterprise'];
  return order.indexOf(depth) >= order.indexOf(minDepth);
}

/**
 * Generate cross-reference block to related agents.
 * Each agent type maps to its related agents for better collaboration.
 */
export function crossRef(agentId: string, ctx: TemplateContext): string {
  const { stack } = ctx;

  const agentRelations: Record<string, { id: string; name: string; when: string }[]> = {
    'backend': [
      { id: 'database-engineer', name: 'Database Engineer', when: 'Criar/alterar entities, migrations, queries' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Novo endpoint, auth flow, dados sensíveis' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — plano de testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Antes de criar novo módulo — verificar débito' },
    ],
    'frontend': [
      { id: 'backend', name: 'Backend Developer', when: 'Antes de integrar — doc de integração obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — testes e2e' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Forms, auth UI, dados sensíveis' },
    ],
    'flutter': [
      { id: 'backend', name: 'Backend Developer', when: 'Antes de integrar — doc de integração obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Após implementação — testes de widget e integração' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Armazenamento local, biometria, deep links' },
    ],
    'database-engineer': [
      { id: 'backend', name: 'Backend Developer', when: 'Após migration — atualizar entities e queries' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Dados sensíveis, PII, encryption at rest' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Schema com N+1, índices faltantes' },
    ],
    'security-auditor': [
      { id: 'backend', name: 'Backend Developer', when: 'Falha de segurança em endpoint/service' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'Encryption at rest, data masking' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Testes de segurança (fuzzing, pentest)' },
    ],
    'qa-test': [
      { id: 'backend', name: 'Backend Developer', when: 'Cobertura insuficiente em services' },
      { id: 'frontend', name: 'Frontend Developer', when: 'Testes e2e falhando, componentes sem testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Testes com .skip(), mocks frágeis' },
    ],
    'tech-debt': [
      { id: 'backend', name: 'Backend Developer', when: 'Refatoração de módulo, god class' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'N+1 queries, índices, schema refactoring' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'Débito de segurança (dependencies, configs)' },
    ],
    'code-review': [
      { id: 'security-auditor', name: 'Security Auditor', when: 'Review de endpoints, auth, dados sensíveis' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'Verificar cobertura e qualidade dos testes' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Avaliar impacto em débito técnico' },
    ],
    'orchestrator': [
      { id: 'backend', name: 'Backend Developer', when: 'Features que tocam backend' },
      { id: 'frontend', name: 'Frontend Developer', when: 'Features que tocam frontend' },
      { id: 'flutter', name: 'Flutter UI Developer', when: 'Features que tocam app mobile' },
      { id: 'database-engineer', name: 'Database Engineer', when: 'Features que tocam banco de dados' },
      { id: 'security-auditor', name: 'Security Auditor', when: 'TODA feature — revisão obrigatória' },
      { id: 'qa-test', name: 'QA Test Engineer', when: 'TODA feature — plano de testes obrigatório' },
      { id: 'tech-debt', name: 'Tech Debt Controller', when: 'Antes de nova feature — checar débito' },
    ],
  };

  const relations = agentRelations[agentId] || [];

  // Filter based on stack capabilities
  const filtered = relations.filter(r => {
    if (r.id === 'frontend' && !stack.hasFrontend) return false;
    if (r.id === 'flutter' && !stack.hasMobile) return false;
    if (r.id === 'database-engineer' && !stack.hasDatabase) return false;
    return true;
  });

  if (filtered.length === 0) return '';

  return `
## 🔗 Cross-References (Agentes Relacionados)

| Agente | Quando Consultar |
|--------|-----------------|
${filtered.map(r => `| **${r.name}** | ${r.when} |`).join('\n')}

> **Regra:** Nunca implementar isoladamente. Sempre verificar se o agente relacionado precisa ser consultado.
`;
}

/**
 * Generate domain badge for agent headers.
 */
export function domainBadge(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain) return '';

  const { domain } = enriched;
  return `
> 📌 **Domínio:** ${domain.domain} · **Sub-domínio:** ${domain.subDomain} · **Confiança:** ${Math.round(domain.confidence * 100)}%
`;
}

/**
 * Generate compliance badges.
 */
export function complianceBadges(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain?.compliance?.length) return '';

  return `
### ⚖️ Compliance Obrigatório

${enriched.domain.compliance.map((c: any) => `- **${c.name}** — ${c.reason}
  - Checks: ${c.mandatoryChecks.join(', ')}`).join('\n')}
`;
}

/**
 * Generate project depth indicator for headers.
 */
export function depthIndicator(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  const depth = enriched.projectDepth || 'medium';
  const labels: Record<string, string> = {
    small: '🟢 Projeto Pequeno (< 50 arquivos)',
    medium: '🟡 Projeto Médio (50-200 arquivos)',
    large: '🟠 Projeto Grande (200-500 arquivos)',
    enterprise: '🔴 Enterprise (500+ arquivos)',
  };
  return labels[depth];
}

/**
 * Build a summary table of modules for context sections.
 * Limits output based on project depth.
 */
export function modulesSummaryTable(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.modules?.length) return '';

  const maxModules = depthScale(ctx, { small: 5, medium: 10, large: 20, enterprise: 50 });
  const modules = enriched.modules.slice(0, maxModules);

  return `
| Módulo | Arquivos | Testes | Entidades | Camada |
|--------|----------|--------|-----------|--------|
${modules.map((m: any) => `| ${m.name} | ${m.fileCount} | ${m.hasTests ? '✅' : '❌'} | ${m.entities.length > 0 ? m.entities.join(', ') : '—'} | ${m.layer} |`).join('\n')}
${enriched.modules.length > maxModules ? `\n> ... e mais ${enriched.modules.length - maxModules} módulos.` : ''}
`;
}

/**
 * Build integrations summary.
 */
export function integrationsSummary(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain?.integrations?.length) return '';

  return `
### Integrações Externas Detectadas

${enriched.domain.integrations.map((i: any) => `- **${i.name}** (${i.type}) — detectado em \`${i.detectedFrom}\``).join('\n')}
`;
}
