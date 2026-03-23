import { EnrichedTemplateContext, TemplateContext } from '../../types.js';
import { getEnriched } from '../template-helpers.js';

/**
 * Detecta padrões arquiteturais nos módulos do projeto
 * e gera skills/documentação para o diretório skills/.
 */

interface DetectedPattern {
  name: string;
  description: string;
  examples: string[];
  howToCreate: string;
}

/**
 * Analisa módulos e detecta padrões recorrentes (adapters, factories, extractors, etc.)
 */
function detectPatterns(ctx: TemplateContext | EnrichedTemplateContext): DetectedPattern[] {
  const enriched = getEnriched(ctx);
  const modules = enriched.modules || [];
  const patterns: DetectedPattern[] = [];

  // Collect all file/class names from modules
  const allFiles: string[] = [];
  const allServices: string[] = [];
  const allControllers: string[] = [];
  const allEntities: string[] = [];

  for (const mod of modules) {
    allServices.push(...mod.services);
    allControllers.push(...mod.controllers);
    allEntities.push(...mod.entities);
    allFiles.push(...mod.testFiles);
  }

  const allNames = [...allServices, ...allControllers, ...allEntities, ...allFiles];

  // Detect Adapter pattern
  const adapters = allNames.filter(n => /adapter/i.test(n));
  if (adapters.length > 0) {
    patterns.push({
      name: 'Adapter Pattern',
      description: 'O projeto utiliza o padrão Adapter para abstrair integrações externas e garantir desacoplamento.',
      examples: adapters.slice(0, 5),
      howToCreate: `1. Criar interface no domínio: \`I{Nome}Port\`
2. Implementar adapter: \`{Nome}Adapter implements I{Nome}Port\`
3. Registrar no container de DI
4. Escrever testes unitários com mock do adapter
5. Garantir que o domínio nunca importe o adapter diretamente`,
    });
  }

  // Detect Factory pattern
  const factories = allNames.filter(n => /factory/i.test(n));
  if (factories.length > 0) {
    patterns.push({
      name: 'Factory Pattern',
      description: 'Factories são usadas para encapsular a lógica de criação de objetos complexos.',
      examples: factories.slice(0, 5),
      howToCreate: `1. Criar classe factory: \`{Nome}Factory\`
2. Método principal: \`create({params}): {Tipo}\`
3. Encapsular validações e defaults
4. Escrever testes para cada variação de criação`,
    });
  }

  // Detect Extractor pattern
  const extractors = allNames.filter(n => /extractor|parser|reader/i.test(n));
  if (extractors.length > 0) {
    patterns.push({
      name: 'Extractor/Parser Pattern',
      description: 'Extractors/Parsers são usados para extrair e transformar dados de fontes externas (PDFs, APIs, arquivos).',
      examples: extractors.slice(0, 5),
      howToCreate: `1. Criar interface: \`I{Tipo}Extractor\`
2. Implementar: \`{Tipo}Extractor implements I{Tipo}Extractor\`
3. Método principal: \`extract(source): ExtractedData\`
4. Testar com fixtures (dados de exemplo)
5. Tratar edge cases: dados vazios, formato inválido, timeout`,
    });
  }

  // Detect Repository pattern
  const repositories = allNames.filter(n => /repository|repo/i.test(n));
  if (repositories.length > 0) {
    patterns.push({
      name: 'Repository Pattern',
      description: 'Repositories abstraem o acesso a dados, separando lógica de negócio da persistência.',
      examples: repositories.slice(0, 5),
      howToCreate: `1. Criar interface: \`I{Entidade}Repository\`
2. Métodos padrão: findById, findAll, save, delete
3. Implementar com ORM ou query builder
4. Testar com banco in-memory ou mock`,
    });
  }

  // Detect Middleware/Guard pattern
  const middlewares = allNames.filter(n => /middleware|guard|interceptor|pipe/i.test(n));
  if (middlewares.length > 0) {
    patterns.push({
      name: 'Middleware/Guard Pattern',
      description: 'Middlewares e Guards implementam cross-cutting concerns (auth, logging, validation).',
      examples: middlewares.slice(0, 5),
      howToCreate: `1. Criar middleware/guard com interface do framework
2. Implementar lógica de interceptação
3. Registrar no pipeline de request
4. Testar isoladamente com request mocking`,
    });
  }

  // Detect DTO/Schema pattern
  const dtos = allNames.filter(n => /dto|schema|model|entity/i.test(n));
  if (dtos.length > 2) { // Only if there are several
    patterns.push({
      name: 'DTO/Schema Pattern',
      description: 'DTOs e Schemas definem contratos de entrada/saída e validações.',
      examples: dtos.slice(0, 5),
      howToCreate: `1. Criar DTO/Schema para cada endpoint
2. Validações no DTO (não no controller)
3. Separar RequestDTO e ResponseDTO
4. Documentar campos obrigatórios e opcionais
5. Usar validação automática do framework`,
    });
  }

  // Detect Service Layer pattern (almost always present)
  if (allServices.length > 1) {
    patterns.push({
      name: 'Service Layer Pattern',
      description: 'Services encapsulam toda a lógica de negócio, mantendo controllers finos.',
      examples: allServices.slice(0, 5),
      howToCreate: `1. Criar service: \`{Domínio}Service\`
2. Injetar dependências via constructor
3. Um método por caso de uso (SRP)
4. Lançar exceções de domínio (não HTTP)
5. Testar unitariamente com mocks de dependências`,
    });
  }

  return patterns;
}

/**
 * Gera conteúdo do skill principal do projeto
 */
export function generateProjectSkills(ctx: TemplateContext | EnrichedTemplateContext): string | null {
  const enriched = getEnriched(ctx);
  const patterns = detectPatterns(ctx);
  const stack = 'stack' in ctx ? ctx.stack : undefined;
  const domain = enriched.domain;

  if (patterns.length === 0) {
    return null; // Não gerar se não houver padrões detectados
  }

  const langs = stack?.languages.map((l) => l.toLowerCase()) || [];
  const isPython = langs.includes('python');
  const isDart = langs.includes('dart');
  const isGo = langs.includes('go');

  // Naming convention per language
  let fileConvention = 'camelCase para arquivos, PascalCase para classes';
  if (isPython) fileConvention = 'snake_case para arquivos e funções, PascalCase para classes';
  else if (isDart) fileConvention = 'snake_case para arquivos, camelCase para funções, PascalCase para classes';
  else if (isGo) fileConvention = 'lowercase para pacotes, PascalCase para exports, camelCase para privados';

  // Build frameworks label from enriched detectedFrameworks (most accurate) or stack.frameworks
  const detectedFw = enriched.detectedFrameworks;
  const frameworksLabel = detectedFw && detectedFw.length > 0
    ? detectedFw.map(f => f.version ? `${f.name} v${f.version}` : f.name).join(', ')
    : (stack?.frameworks.length ? stack.frameworks.join(', ') : 'Não detectados');

  const patternsContent = patterns.map(p => `### ${p.name}

${p.description}

**Exemplos no projeto:**
${p.examples.map(e => `- \`${e}\``).join('\n')}

**Como criar um novo:**
${p.howToCreate}
`).join('\n---\n\n');

  const domainSection = domain ? `
---

## Padrões de Domínio: ${domain.domain}${domain.subDomain ? ` / ${domain.subDomain}` : ''}

${domain.businessEntities?.length ? `### Entidades de Negócio
${domain.businessEntities.map(e => `- **${e.name}**: ${e.fields?.join(', ') || 'campos detectados'}`).join('\n')}` : ''}

${domain.integrations?.length ? `### Integrações
${domain.integrations.map(i => `- **${i.name}** (${i.type})`).join('\n')}` : ''}

${domain.compliance?.length ? `### Compliance
${domain.compliance.map(c => `- **${c.name}**: ${c.reason}`).join('\n')}` : ''}
` : '';

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Padrões e convenções específicos do projeto'
version: 3.1.0
---

# 📚 Skills: Padrões do Projeto

> Referência rápida dos padrões arquiteturais detectados e como seguí-los.

---

## Convenções

- **Nomenclatura de arquivos:** ${fileConvention}
- **Stack:** ${stack?.languages.join(', ') || 'Não detectada'}
- **Frameworks:** ${frameworksLabel}

---

## Padrões Arquiteturais Detectados

${patternsContent}
${domainSection}
---

## Checklist para Novo Código

\`\`\`
□ Segue os padrões acima?
□ Testes escritos antes do código (TDD)?
□ Nomenclatura consistente com convenções?
□ Sem duplicação de lógica existente?
□ Documentação atualizada (JSDoc/docstring)?
\`\`\`
`;
}
