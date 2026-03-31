    // @ts-ignore - Audit cleanup unused variable
import { TemplateContext, EnrichedTemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';
    // @ts-ignore - Audit cleanup unused variable
import { FrameworkInfo } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';

import { getEnriched, depthScale } from './base-helpers.js';

export function domainBadge(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain) return '';

  const { domain } = enriched;
  return `
> 📌 **Domínio:** ${domain.domain} · **Sub-domínio:** ${domain.subDomain} · **Confiança:** ${Math.round(domain.confidence * 100)}%
`;
}

export function complianceBadges(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain?.compliance?.length) return '';

  return `
### ⚖️ Compliance Obrigatório

${enriched.domain.compliance.map((c: any) => `- **${c.name}** — ${c.reason}
  - Checks: ${c.mandatoryChecks.join(', ')}`).join('\n')}
`;
}

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

export function modulesSummaryTable(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.modules?.length) return '';

  const maxModules = depthScale(ctx, { small: 5, medium: 10, large: 20, enterprise: 50 });
  const modules = enriched.modules.slice(0, maxModules);

  return `
| Módulo | Arquivos | Linhas | Testes | Camada |
|--------|----------|--------|--------|--------|
${modules.map((m: any) => `| ${m.name} | ${m.fileCount} | ${m.lineCount > 0 ? m.lineCount.toLocaleString() : '—'} | ${m.hasTests ? '✅' : '❌'} | ${m.layer} |`).join('\n')}
${enriched.modules.length > maxModules ? `\n> ... e mais ${enriched.modules.length - maxModules} módulos.` : ''}
`;
}

export function integrationsSummary(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.domain?.integrations?.length) return '';

  return `
### Integrações Externas Detectadas

${enriched.domain.integrations.map((i: any) => `- **${i.name}** (${i.type}) — detectado em \`${i.detectedFrom}\``).join('\n')}
`;
}

