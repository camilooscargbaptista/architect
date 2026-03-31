    // @ts-ignore - Audit cleanup unused variable
import { TemplateContext, EnrichedTemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';
    // @ts-ignore - Audit cleanup unused variable
import { FrameworkInfo } from '@girardelli/architect-agents/src/core/agent-generator/types/stack.js';

import { getEnriched } from './base-helpers.js';

export function frameworkBadge(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.detectedFrameworks?.length) return '';

  const fws = enriched.detectedFrameworks
    .filter((f: any) => f.category === 'web' || f.category === 'orm')
    .map((f: any) => `**${f.name}**${f.version ? ` ${f.version}` : ''}`);

  const testFws = enriched.detectedFrameworks
    .filter((f: any) => f.category === 'test')
    .map((f: any) => f.name);

  const lintFws = enriched.detectedFrameworks
    .filter((f: any) => f.category === 'lint')
    .map((f: any) => f.name);

  const parts: string[] = [];
  if (fws.length) parts.push(fws.join(' + '));
  if (testFws.length) parts.push(`Testes: ${testFws.join(', ')}`);
  if (lintFws.length) parts.push(`Lint: ${lintFws.join(', ')}`);

  return `> 🚀 **Stack Detectada:** ${parts.join(' · ')}`;
}

export function projectStructureBadge(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  const structure = enriched.projectStructure || 'unknown';

  const labels: Record<string, string> = {
    'clean-architecture': '🏛️ Clean Architecture / DDD',
    'mvc': '📐 MVC (Model-View-Controller)',
    'modular': '📦 Modular (Feature-based)',
    'flat': '📄 Flat Structure',
    'monorepo': '🏗️ Monorepo',
    'unknown': '❓ Estrutura não identificada',
  };

  return labels[structure] || labels['unknown'];
}

export function toolchainCommands(ctx: TemplateContext): string {
  const enriched = getEnriched(ctx);
  if (!enriched.toolchain) return '';

  const tc = enriched.toolchain;
  return `
## 🔧 Toolchain Detectado

\`\`\`bash
# Build
${tc.buildCmd}

# Testes
${tc.testCmd}

# Lint
${tc.lintCmd}

# Coverage
${tc.coverageCmd}

# Dev Server
${tc.runCmd}

# Instalar dependências
${tc.installCmd}
${tc.migrateCmd ? `\n# Migrations\n${tc.migrateCmd}` : ''}
\`\`\`

> **Deps file:** \`${tc.depsFile}\`
`;
}

