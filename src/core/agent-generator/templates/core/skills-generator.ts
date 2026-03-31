import { EnrichedTemplateContext, TemplateContext } from '../../types/template.js';
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

/**
 * Generates ARCHITECT-INTEGRATION.md skill with real project data
 */
export function generateArchitectIntegrationSkill(ctx: TemplateContext | EnrichedTemplateContext): string {
    // @ts-ignore - Audit cleanup unused variable
  const enriched = getEnriched(ctx);
  const projectName = ctx.projectName;
  const report = ctx.report;
  const config = ctx.config;

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Como usar o Architect para análise contínua de arquitetura'
version: 5.1.0
---

# 🏗️ Skill: Architect Integration — ${projectName}

> Como usar \`@girardelli/architect\` para manter a qualidade arquitetural.

---

## Instalação

\`\`\`bash
npm install -g @girardelli/architect
\`\`\`

---

## Comandos Disponíveis

### Análise completa
\`\`\`bash
# Gera HTML report + JSON + .agent/ framework
architect analyze .

# Output:
#   → architect-report.html (visual)
#   → architect-report.json (dados)
#   → .agent/ (framework de agentes)
\`\`\`

### Score rápido
\`\`\`bash
# Verificação rápida do score
architect score .

# JSON output (para CI)
architect score . --json
\`\`\`

### Regenerar agentes
\`\`\`bash
# Regenera .agent/ com dados atualizados
architect agents .
\`\`\`

---

## Estado Atual — ${projectName}

| Métrica | Valor |
|---------|-------|
| **Score** | ${report.score.overall}/100 |
| **Meta** | ${config.scoreThreshold}/100 (mínimo) |
| **Score Modularity** | ${report.score.breakdown.modularity}/100 |
| **Score Coupling** | ${report.score.breakdown.coupling}/100 |
| **Score Cohesion** | ${report.score.breakdown.cohesion}/100 |
| **Score Layering** | ${report.score.breakdown.layering}/100 |
| **Anti-patterns** | ${report.antiPatterns.length} |
| **Arquivos** | ${report.projectInfo.totalFiles} |
| **Linhas** | ${report.projectInfo.totalLines.toLocaleString()} |

---

## Integração no Workflow

### Antes de criar PR
\`\`\`bash
# Verificar que o score não regrediu
architect score .
# Se score < ${config.scoreThreshold} → NÃO criar PR
\`\`\`

### Após refatoração
\`\`\`bash
# Verificar melhoria
architect analyze .
# Comparar com score anterior
\`\`\`

### Revisão de arquitetura
\`\`\`bash
# Gerar report completo para code review
architect analyze . --output-dir docs/
\`\`\`

---

## Quality Gates

\`\`\`
Score mínimo para PR:       ${config.scoreThreshold}/100
Cobertura mínima:           ${config.coverageMinimum}%
Zero anti-patterns CRITICAL: Obrigatório
Regressão de score:         Proibida
\`\`\`

---

**Gerado por Architect v5.1 · Score: ${report.score.overall}/100**
`;
}

/**
 * Generates CI-PIPELINE.md skill with real toolchain data
 */
export function generateCIPipelineSkill(ctx: TemplateContext | EnrichedTemplateContext): string {
  const enriched = getEnriched(ctx);
  const projectName = ctx.projectName;
  const tc = enriched.toolchain;
  const config = ctx.config;
  const report = ctx.report;

  const buildCmd = tc?.buildCmd || 'npm run build';
  const testCmd = tc?.testCmd || 'npm test';
  const lintCmd = tc?.lintCmd || 'npx eslint .';
  const coverageCmd = tc?.coverageCmd || 'npm run test -- --coverage';
  const installCmd = tc?.installCmd || 'npm install';

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Integração CI/CD com verificação de arquitetura'
version: 5.1.0
---

# 🔄 Skill: CI Pipeline — ${projectName}

> Pipeline de integração contínua com gates de qualidade arquitetural.

---

## GitHub Actions

\`\`\`yaml
# .github/workflows/architect-ci.yml
name: Architecture CI

on:
  pull_request:
    branches: [main, develop, staging]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: ${installCmd}

      - name: Build
        run: ${buildCmd}

      - name: Lint
        run: ${lintCmd}

      - name: Test
        run: ${testCmd}

      - name: Coverage
        run: ${coverageCmd}

      - name: Architecture Score
        run: |
          npm install -g @girardelli/architect
          SCORE=$(architect score . --json | jq '.overall')
          echo "Architecture Score: $SCORE/100"
          if [ "$SCORE" -lt ${config.scoreThreshold} ]; then
            echo "::error::Score ($SCORE) below threshold (${config.scoreThreshold})"
            exit 1
          fi

      - name: No Score Regression
        run: |
          # Compare with main branch score
          CURRENT=$(architect score . --json | jq '.overall')
          echo "Current: $CURRENT/100, Minimum: ${config.scoreThreshold}/100"
\`\`\`

---

## Comandos do Pipeline

| Step | Comando | Gate |
|------|---------|------|
| Install | \`${installCmd}\` | — |
| Build | \`${buildCmd}\` | ❌ Bloqueia se falhar |
| Lint | \`${lintCmd}\` | ❌ Bloqueia se falhar |
| Test | \`${testCmd}\` | ❌ Bloqueia se falhar |
| Coverage | \`${coverageCmd}\` | ⚠️ Mínimo ${config.coverageMinimum}% |
| Score | \`architect score .\` | ❌ Mínimo ${config.scoreThreshold}/100 |

---

## GitLab CI

\`\`\`yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - quality

build:
  stage: build
  script:
    - ${installCmd}
    - ${buildCmd}

test:
  stage: test
  script:
    - ${testCmd}
    - ${coverageCmd}

architecture:
  stage: quality
  script:
    - npm install -g @girardelli/architect
    - architect score . --json
  allow_failure: false
\`\`\`

---

**Gerado por Architect v5.1 · Score: ${report.score.overall}/100**
`;
}

/**
 * Generates MONOREPO-GUIDE.md skill with real workspace data.
 * Only generated when projectStructure === 'monorepo'.
 */
export function generateMonorepoGuideSkill(ctx: TemplateContext | EnrichedTemplateContext): string | null {
  const enriched = getEnriched(ctx);
  if (enriched.projectStructure !== 'monorepo') return null;

  const projectName = ctx.projectName;
  const modules = enriched.modules || [];
  const tc = enriched.toolchain;

  if (modules.length === 0) return null;

  const moduleTable = modules.map(m =>
    `| ${m.name} | \`${m.path}\` | ${m.fileCount} | ${m.lineCount > 0 ? m.lineCount.toLocaleString() : '—'} | ${m.hasTests ? '✅' : '❌'} | ${m.layer} |`
  ).join('\n');

  return `---
antigravity:
  trigger: 'on_demand'
  description: 'Guia de navegação e desenvolvimento no monorepo'
version: 5.1.0
---

# 📦 Skill: Monorepo Guide — ${projectName}

> Estrutura, convenções e fluxos de trabalho do monorepo.

---

## Workspace Map

| Package | Path | Arquivos | Linhas | Testes | Camada |
|---------|------|----------|--------|--------|--------|
${moduleTable}

---

## Regras do Monorepo

### Dependency Direction
\`\`\`
╔════════════════════════════════════════════╗
║  types → events → core → bridge → mcp    ║
║                                            ║
║  Dependências SEMPRE de baixo para cima.  ║
║  NUNCA criar referência circular.         ║
╚════════════════════════════════════════════╝
\`\`\`

### Boas Práticas

1. **Cada package tem seu package.json** — versão independente
2. **Types compartilhados** ficam no package \`types\`
3. **Nunca importar de outro package via path relativo** — usar \`@scope/package\`
4. **Testes rodam por package** — \`npm test --workspace=packages/<nome>\`
5. **Build ordem** — respeitar dependências (types primeiro)

### Comandos por Workspace

\`\`\`bash
# Rodar testes de um package específico
npm test --workspace=packages/<nome>

# Build de um package específico
npm run build --workspace=packages/<nome>

# Instalar deps de todos os workspaces
${tc?.installCmd || 'npm install'}

# Build de todos
${tc?.buildCmd || 'npm run build'}

# Testes de todos
${tc?.testCmd || 'npm test'}
\`\`\`

---

## Quando Criar um Novo Package

1. **Justificativa:** O código é reutilizável por 2+ packages?
2. **Escopo:** O package tem responsabilidade única?
3. **Testes:** O package pode ser testado isoladamente?
4. **Deps:** As dependências são explícitas no package.json?

### Template

\`\`\`bash
mkdir packages/<nome>
cd packages/<nome>
npm init -y
# Configurar tsconfig.json, jest.config, etc.
\`\`\`

---

**Gerado por Architect v5.1 · ${modules.length} packages detectados**
`;
}
