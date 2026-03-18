import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { AnalysisReport, RefactoringPlan } from './types.js';

/**
 * Stack detection result from project analysis.
 */
export interface StackInfo {
  primary: string;
  languages: string[];
  frameworks: string[];
  hasBackend: boolean;
  hasFrontend: boolean;
  hasMobile: boolean;
  hasDatabase: boolean;
  testFramework: string;
  packageManager: string;
}

/**
 * Audit finding for existing agent directories.
 */
export interface AgentAuditFinding {
  type: 'MISSING' | 'OUTDATED' | 'IMPROVEMENT' | 'OK';
  category: string;
  file: string;
  description: string;
  suggestion?: string;
}

/**
 * Result from suggest() — no files written, just recommendations.
 */
export interface AgentSuggestion {
  stack: StackInfo;
  hasExistingAgents: boolean;
  suggestedAgents: string[];
  suggestedRules: string[];
  suggestedGuards: string[];
  suggestedWorkflows: string[];
  suggestedSkills: { name: string; source: string; description: string }[];
  audit: AgentAuditFinding[];
  command: string;
}

/**
 * Agent Generator — Creates or audits .agent/ directories
 * customized to the analyzed project's stack and architecture.
 */
export class AgentGenerator {
  private stack!: StackInfo;
  private report!: AnalysisReport;
  private plan!: RefactoringPlan;

  /**
   * Suggest agents without writing files — for unified report.
   */
  suggest(
    report: AnalysisReport,
    plan: RefactoringPlan,
    projectPath: string,
  ): AgentSuggestion {
    this.report = report;
    this.plan = plan;
    this.stack = this.detectStack(report);

    const agentDir = join(projectPath, '.agent');
    const isExisting = existsSync(agentDir);

    const suggestedAgents: string[] = [];
    // Always suggest core agents
    suggestedAgents.push('AGENT-ORCHESTRATOR');
    if (this.stack.hasBackend) suggestedAgents.push(`${this.stack.primary.toUpperCase()}-BACKEND-DEVELOPER`);
    if (this.stack.hasFrontend) {
      const fw = this.stack.frameworks.find(f =>
        ['Angular', 'Vue', 'Next.js', 'React'].includes(f)) || 'FRONTEND';
      suggestedAgents.push(`${fw.toUpperCase().replace('.', '')}-FRONTEND-DEVELOPER`);
    }
    if (this.stack.hasMobile) suggestedAgents.push('FLUTTER-UI-DEVELOPER');
    if (this.stack.hasDatabase) suggestedAgents.push('DATABASE-ENGINEER');
    suggestedAgents.push('SECURITY-AUDITOR', 'QA-TEST-ENGINEER', 'TECH-DEBT-CONTROLLER');

    const suggestedRules = ['00-general', '01-architecture', '02-security'];
    if (this.stack.hasBackend) suggestedRules.push(`03-${this.stack.primary.toLowerCase()}`);

    const suggestedGuards = ['PREFLIGHT', 'QUALITY-GATES', 'CODE-REVIEW-CHECKLIST'];
    const suggestedWorkflows = ['develop', 'fix-bug', 'review'];

    // Skills from skills.sh — mapped to detected stack
    const suggestedSkills: { name: string; source: string; description: string }[] = [
      // Universal skills
      { name: 'test-driven-development', source: 'anthropic/courses/test-driven-development', description: 'TDD workflow: Red → Green → Refactor' },
      { name: 'systematic-debugging', source: 'anthropic/courses/systematic-debugging', description: 'Structured debugging methodology' },
      { name: 'code-review', source: 'anthropic/courses/requesting-code-review', description: 'Code review best practices' },
      { name: 'security-best-practices', source: 'anthropic/courses/security-best-practices', description: 'Security patterns and vulnerability prevention' },
      { name: 'performance-optimization', source: 'anthropic/courses/performance-optimization', description: 'Performance analysis and optimization' },
      { name: 'git-workflow', source: 'anthropic/courses/git-workflow', description: 'Git branching, commits, and collaboration' },
    ];

    // Stack-specific
    if (this.stack.languages.includes('TypeScript') || this.stack.languages.includes('JavaScript')) {
      suggestedSkills.push(
        { name: 'next-best-practices', source: 'vercel-labs/skills/next-best-practices', description: 'Next.js patterns and performance' },
        { name: 'api-design-principles', source: 'anthropic/courses/api-design-principles', description: 'REST/GraphQL API design' },
      );
    }
    if (this.stack.frameworks.includes('Angular') || this.stack.frameworks.includes('Vue') || this.stack.frameworks.includes('React') || this.stack.frameworks.includes('Next.js')) {
      suggestedSkills.push(
        { name: 'frontend-design', source: 'anthropic/courses/frontend-design', description: 'Modern frontend patterns and UI/UX' },
        { name: 'web-accessibility', source: 'anthropic/courses/web-accessibility', description: 'WCAG accessibility standards' },
        { name: 'ui-ux-pro-max', source: 'anthropic/courses/ui-ux-pro-max', description: '50 styles, 21 palettes, 50 font pairings' },
      );
    }
    if (this.stack.frameworks.includes('Vue')) {
      suggestedSkills.push(
        { name: 'vue-best-practices', source: 'anthropic/courses/vue-best-practices', description: 'Vue.js composition API and patterns' },
      );
    }
    if (this.stack.languages.includes('Dart') || this.stack.frameworks.includes('Flutter')) {
      suggestedSkills.push(
        { name: 'flutter-animations', source: 'anthropic/courses/flutter-animations', description: 'Flutter animation patterns' },
      );
    }
    if (this.stack.languages.includes('Python')) {
      suggestedSkills.push(
        { name: 'python-performance', source: 'anthropic/courses/python-performance-optimization', description: 'Python optimization and profiling' },
      );
    }
    if (this.stack.hasDatabase) {
      suggestedSkills.push(
        { name: 'database-schema-design', source: 'anthropic/courses/database-schema-design', description: 'Schema design, indexing, migrations' },
      );
    }

    let audit: AgentAuditFinding[] = [];
    if (isExisting) {
      audit = this.auditExisting(agentDir);
    }

    return {
      stack: this.stack,
      hasExistingAgents: isExisting,
      suggestedAgents,
      suggestedRules,
      suggestedGuards,
      suggestedWorkflows,
      suggestedSkills,
      audit,
      command: `architect agents ${projectPath}`,
    };
  }

  /**
   * Main entry: generate or audit .agent/ for a project.
   */
  generate(
    report: AnalysisReport,
    plan: RefactoringPlan,
    projectPath: string,
    outputDir?: string
  ): { generated: string[]; audit: AgentAuditFinding[] } {
    this.report = report;
    this.plan = plan;
    this.stack = this.detectStack(report);

    const agentDir = outputDir || join(projectPath, '.agent');
    const isExisting = existsSync(agentDir);

    if (isExisting) {
      const audit = this.auditExisting(agentDir);
      const generated = this.generateMissing(agentDir, audit);
      return { generated, audit };
    }

    const generated = this.generateFull(agentDir);
    return { generated, audit: [] };
  }

  /**
   * Detect technology stack from the analysis report.
   */
  private detectStack(report: AnalysisReport): StackInfo {
    const files = report.dependencyGraph.nodes;
    const extensions = new Set<string>();
    const languages = new Set<string>();
    const frameworks = new Set<string>();

    for (const file of files) {
      const ext = file.split('.').pop()?.toLowerCase() || '';
      extensions.add(ext);
    }

    // Detect languages
    if (extensions.has('py')) languages.add('Python');
    if (extensions.has('ts') || extensions.has('tsx')) languages.add('TypeScript');
    if (extensions.has('js') || extensions.has('jsx')) languages.add('JavaScript');
    if (extensions.has('dart')) languages.add('Dart');
    if (extensions.has('go')) languages.add('Go');
    if (extensions.has('rs')) languages.add('Rust');
    if (extensions.has('java') || extensions.has('kt')) languages.add('Java/Kotlin');
    if (extensions.has('rb')) languages.add('Ruby');
    if (extensions.has('php')) languages.add('PHP');
    if (extensions.has('cs')) languages.add('C#');

    // Detect frameworks from file patterns
    const allFiles = files.join(' ');
    if (allFiles.includes('manage.py') || allFiles.includes('django')) frameworks.add('Django');
    if (allFiles.includes('flask') || allFiles.includes('app.py')) frameworks.add('Flask');
    if (allFiles.includes('fastapi')) frameworks.add('FastAPI');
    if (allFiles.includes('.module.ts') || allFiles.includes('nest')) frameworks.add('NestJS');
    if (allFiles.includes('.component.ts') || allFiles.includes('angular')) frameworks.add('Angular');
    if (allFiles.includes('.vue')) frameworks.add('Vue');
    if (allFiles.includes('.tsx') && allFiles.includes('next')) frameworks.add('Next.js');
    if (allFiles.includes('.dart')) frameworks.add('Flutter');
    if (allFiles.includes('go.mod')) frameworks.add('Go Modules');
    if (allFiles.includes('Cargo.toml')) frameworks.add('Cargo');
    if (allFiles.includes('pom.xml') || allFiles.includes('build.gradle')) frameworks.add('Spring');

    const primary = languages.size > 0 ? [...languages][0] : 'Unknown';
    const hasBackend = languages.has('Python') || languages.has('TypeScript') ||
      languages.has('Go') || languages.has('Java/Kotlin') || languages.has('Ruby') || languages.has('PHP');
    const hasFrontend = frameworks.has('Angular') || frameworks.has('Vue') ||
      frameworks.has('Next.js') || extensions.has('html');
    const hasMobile = languages.has('Dart') || frameworks.has('Flutter');
    const hasDatabase = allFiles.includes('migration') || allFiles.includes('entity') ||
      allFiles.includes('model') || allFiles.includes('schema');

    let testFramework = 'Jest';
    if (languages.has('Python')) testFramework = 'pytest';
    if (languages.has('Go')) testFramework = 'go test';
    if (languages.has('Dart')) testFramework = 'flutter_test';

    let packageManager = 'npm';
    if (languages.has('Python')) packageManager = 'pip';
    if (languages.has('Go')) packageManager = 'go mod';
    if (languages.has('Dart')) packageManager = 'pub';

    return {
      primary, languages: [...languages], frameworks: [...frameworks],
      hasBackend, hasFrontend, hasMobile, hasDatabase,
      testFramework, packageManager,
    };
  }

  // ── Audit Existing ──

  private auditExisting(agentDir: string): AgentAuditFinding[] {
    const findings: AgentAuditFinding[] = [];

    const checkExists = (subpath: string, category: string, desc: string): void => {
      const full = join(agentDir, subpath);
      if (!existsSync(full)) {
        findings.push({ type: 'MISSING', category, file: subpath, description: desc });
      } else {
        findings.push({ type: 'OK', category, file: subpath, description: `${subpath} exists` });
      }
    };

    // Check required structure
    checkExists('INDEX.md', 'core', 'Index file for agent navigation');
    checkExists('agents/AGENT-ORCHESTRATOR.md', 'agents', 'Orchestrator agent');
    checkExists('rules/00-general.md', 'rules', 'General rules');
    checkExists('guards/PREFLIGHT.md', 'guards', 'Preflight checklist');
    checkExists('workflows/develop.md', 'workflows', 'Development workflow');

    // Check stack-specific agents
    if (this.stack.hasBackend) {
      const backendAgent = this.findAgentByRole(agentDir, 'backend');
      if (!backendAgent) {
        findings.push({
          type: 'MISSING', category: 'agents',
          file: `agents/${this.stack.primary.toUpperCase()}-BACKEND-DEVELOPER.md`,
          description: `No backend developer agent for ${this.stack.primary}`,
          suggestion: `Create a ${this.stack.primary} backend agent with patterns, conventions, and architecture rules`,
        });
      }
    }

    if (this.stack.hasFrontend) {
      const frontAgent = this.findAgentByRole(agentDir, 'frontend');
      if (!frontAgent) {
        findings.push({
          type: 'MISSING', category: 'agents',
          file: 'agents/FRONTEND-DEVELOPER.md',
          description: 'No frontend developer agent',
          suggestion: `Create a frontend agent for ${this.stack.frameworks.join(', ')}`,
        });
      }
    }

    // Check for tech debt alignment
    if (this.plan.steps.length > 0) {
      const techDebtAgent = this.findAgentByRole(agentDir, 'tech-debt');
      if (!techDebtAgent) {
        findings.push({
          type: 'IMPROVEMENT', category: 'agents',
          file: 'agents/TECH-DEBT-CONTROLLER.md',
          description: `${this.plan.steps.length} refactoring steps found but no Tech Debt agent`,
          suggestion: 'Create a Tech Debt Controller with the refactoring backlog',
        });
      }
    }

    // Check quality gates match score
    if (this.report.score.overall < 80) {
      findings.push({
        type: 'IMPROVEMENT', category: 'guards',
        file: 'guards/QUALITY-GATES.md',
        description: `Score is ${this.report.score.overall}/100 — quality gates should enforce improvement`,
        suggestion: `Set minimum score threshold to ${this.report.score.overall + 5} and add regression guards`,
      });
    }

    // Check anti-pattern rules
    for (const ap of this.report.antiPatterns) {
      findings.push({
        type: 'IMPROVEMENT', category: 'rules',
        file: `rules/anti-pattern-${ap.name.toLowerCase().replace(/\s+/g, '-')}.md`,
        description: `Anti-pattern "${ap.name}" (${ap.severity}) detected but no prevention rule`,
        suggestion: `Add a rule to prevent "${ap.name}" from recurring`,
      });
    }

    return findings;
  }

  private findAgentByRole(agentDir: string, role: string): string | null {
    const agentsDir = join(agentDir, 'agents');
    if (!existsSync(agentsDir)) return null;

    const files = readdirSync(agentsDir);
    for (const file of files) {
      const content = readFileSync(join(agentsDir, file), 'utf-8').toLowerCase();
      if (content.includes(role)) return file;
    }
    return null;
  }

  private generateMissing(agentDir: string, audit: AgentAuditFinding[]): string[] {
    const generated: string[] = [];
    const missing = audit.filter(f => f.type === 'MISSING');

    for (const finding of missing) {
      const fullPath = join(agentDir, finding.file);
      const dir = join(fullPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const content = this.getTemplateFor(finding.category, finding.file);
      if (content) {
        writeFileSync(fullPath, content);
        generated.push(finding.file);
      }
    }

    return generated;
  }

  // ── Full Generation ──

  private generateFull(agentDir: string): string[] {
    const generated: string[] = [];
    const dirs = ['agents', 'rules', 'guards', 'workflows', 'skills'];
    for (const d of dirs) mkdirSync(join(agentDir, d), { recursive: true });

    // Core files
    const coreFiles: Record<string, string> = {
      'INDEX.md': this.genIndex(),
      'AGENT-CARD-SCHEMA.md': this.genSchema(),
      'agents/AGENT-ORCHESTRATOR.md': this.genOrchestrator(),
      'agents/SECURITY-AUDITOR.md': this.genSecurityAgent(),
      'agents/QA-TEST-ENGINEER.md': this.genQAAgent(),
      'agents/TECH-DEBT-CONTROLLER.md': this.genTechDebtAgent(),
      'rules/00-general.md': this.genGeneralRules(),
      'rules/01-architecture.md': this.genArchitectureRules(),
      'rules/02-security.md': this.genSecurityRules(),
      'guards/PREFLIGHT.md': this.genPreflight(),
      'guards/QUALITY-GATES.md': this.genQualityGates(),
      'guards/CODE-REVIEW-CHECKLIST.md': this.genCodeReview(),
      'workflows/develop.md': this.genDevelopWorkflow(),
      'workflows/fix-bug.md': this.genFixBugWorkflow(),
      'workflows/review.md': this.genReviewWorkflow(),
    };

    // Stack-specific agents
    if (this.stack.hasBackend) {
      coreFiles[`agents/${this.stack.primary.toUpperCase()}-BACKEND-DEVELOPER.md`] =
        this.genBackendAgent();
      coreFiles[`rules/03-${this.stack.primary.toLowerCase()}.md`] =
        this.genStackRules();
    }
    if (this.stack.hasFrontend) {
      const fwName = this.stack.frameworks.find(f =>
        ['Angular', 'Vue', 'Next.js', 'React'].includes(f)) || 'Frontend';
      coreFiles[`agents/${fwName.toUpperCase().replace('.', '')}-FRONTEND-DEVELOPER.md`] =
        this.genFrontendAgent();
    }
    if (this.stack.hasMobile) {
      coreFiles['agents/FLUTTER-UI-DEVELOPER.md'] = this.genMobileAgent();
    }
    if (this.stack.hasDatabase) {
      coreFiles['agents/DATABASE-ENGINEER.md'] = this.genDatabaseAgent();
    }

    for (const [path, content] of Object.entries(coreFiles)) {
      writeFileSync(join(agentDir, path), content);
      generated.push(path);
    }

    return generated;
  }

  private getTemplateFor(category: string, file: string): string | null {
    if (file.includes('ORCHESTRATOR')) return this.genOrchestrator();
    if (file.includes('SECURITY')) return this.genSecurityAgent();
    if (file.includes('QA')) return this.genQAAgent();
    if (file.includes('TECH-DEBT')) return this.genTechDebtAgent();
    if (file.includes('BACKEND')) return this.genBackendAgent();
    if (file.includes('FRONTEND')) return this.genFrontendAgent();
    if (file.includes('INDEX')) return this.genIndex();
    if (file.includes('00-general')) return this.genGeneralRules();
    if (file.includes('PREFLIGHT')) return this.genPreflight();
    if (file.includes('develop')) return this.genDevelopWorkflow();
    return null;
  }

  // ── Template Generators ──

  private get projectName(): string {
    return this.report.projectInfo.name || 'Project';
  }

  private get stackLabel(): string {
    return [
      ...this.stack.languages,
      ...this.stack.frameworks,
    ].join(' + ');
  }

  private genIndex(): string {
    const agents = [
      'AGENT-ORCHESTRATOR',
      ...(this.stack.hasBackend ? [`${this.stack.primary.toUpperCase()}-BACKEND-DEVELOPER`] : []),
      ...(this.stack.hasFrontend ? ['FRONTEND-DEVELOPER'] : []),
      ...(this.stack.hasMobile ? ['FLUTTER-UI-DEVELOPER'] : []),
      ...(this.stack.hasDatabase ? ['DATABASE-ENGINEER'] : []),
      'SECURITY-AUDITOR',
      'QA-TEST-ENGINEER',
      'TECH-DEBT-CONTROLLER',
    ];

    return `# ${this.projectName} — Agent Framework

> **Auto-generated by [Architect v2.1](https://github.com/camilooscargbaptista/architect)**
> Stack: **${this.stackLabel}** | Score: **${this.report.score.overall}/100**

---

## 🔴 Leitura Obrigatória

| # | Arquivo | Propósito |
|---|---------|-----------|
| 1 | [00-general.md](./rules/00-general.md) | Regras gerais do projeto |
| 2 | [PREFLIGHT.md](./guards/PREFLIGHT.md) | Checklist pré-ação |
| 3 | [QUALITY-GATES.md](./guards/QUALITY-GATES.md) | Critérios mínimos |

## 🤖 Agentes Disponíveis

| Agente | Arquivo | Role |
|--------|---------|------|
${agents.map(a => `| ${a} | [${a}.md](./agents/${a}.md) | ${a.includes('ORCHESTRATOR') ? 'coordination' : a.includes('SECURITY') || a.includes('QA') ? 'quality' : 'development'} |`).join('\n')}

## 📁 Estrutura

\`\`\`
.agent/
├── agents/      → Agentes especializados
├── rules/       → Regras de codificação
├── guards/      → Checklists e quality gates
├── workflows/   → Fluxos de trabalho
└── skills/      → Padrões e referências
\`\`\`

---

**⚠️ REGRA DE OURO: Na dúvida, PARA e PERGUNTA.**
`;
  }

  private genSchema(): string {
    return `---
description: 'Schema de referência para Agent Cards — padrão A2A-inspired'
version: 1.0.0
---

# Agent Card Schema

> Cada agente DEVE ter um bloco \`agent_card\` no frontmatter YAML.

## Schema

\`\`\`yaml
agent_card:
  id: "string"               # kebab-case unique ID
  name: "string"              # Human readable name
  role: "enum"                # coordination | development | quality | protection | governance
  capabilities: []            # List of skills
  inputs: []                  # What the agent needs
  outputs: []                 # What the agent produces
  depends_on: []              # Agents that must run before
\`\`\`

## Roles

| Role | Description |
|------|-------------|
| coordination | Orchestrates other agents |
| development | Writes production code |
| quality | Testing and QA |
| protection | Security and compliance |
| governance | Standards and tech debt |
`;
  }

  private genOrchestrator(): string {
    const layers = this.report.layers.map(l => l.name).join(', ');
    const antiPatterns = this.report.antiPatterns.map(a => a.name).join(', ') || 'None detected';

    return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'META-AGENT ORQUESTRADOR — Coordena todos os agentes para ${this.projectName}'
  priority: CRITICAL
agent_card:
  id: 'orchestrator'
  name: 'Agent Orchestrator'
  role: 'coordination'
  capabilities: [request-decomposition, agent-dispatch, plan-consolidation, quality-verification]
  inputs: [user-story, feature-request, bug-report, refactoring-request]
  outputs: [consolidated-plan, implementation-blocks, effort-estimate]
  depends_on: []
version: 1.0.0
---

# 🎭 AGENT-ORCHESTRATOR: ${this.projectName}

> **Centro de comando.** Toda requisição passa por aqui.

## Contexto do Projeto

- **Projeto:** ${this.projectName}
- **Stack:** ${this.stackLabel}
- **Score Atual:** ${this.report.score.overall}/100
- **Camadas:** ${layers}
- **Anti-Patterns:** ${antiPatterns}
- **Arquivos:** ${this.report.projectInfo.totalFiles} files, ${this.report.projectInfo.totalLines} lines

## Missão

\`\`\`
RECEBER REQUISIÇÃO
    ↓
ENTENDER CONTEXTO
    ↓
DISPARAR AGENTES (paralelo)
    ↓
CONSOLIDAR ANÁLISES
    ↓
APRESENTAR PLANO
    ↓
AGUARDAR APROVAÇÃO
    ↓
DELEGAR IMPLEMENTAÇÃO
    ↓
VERIFICAR QUALIDADE
\`\`\`

## Protocolo de Recepção

### FASE 0: Parsing da Requisição

\`\`\`
✓ Nome da feature/fix: _______________
✓ Tipo: [ ] Feature  [ ] Bug Fix  [ ] Refactoring  [ ] Documentation
✓ Camadas tocadas: ${layers}
✓ Complexidade: [ ] XS  [ ] S  [ ] M  [ ] L  [ ] XL
✓ Assunções (listar): _______________
\`\`\`

### FASE 1: Disparo de Agentes

\`\`\`
ORQUESTRADOR analisa requisição
    │
${this.stack.hasBackend ? `    ├──→ [${this.stack.primary.toUpperCase()}-BACKEND]\n    │    • Arquitetura de serviços\n    │    • API contracts\n    │    • Lógica de negócio\n    │\n` : ''}${this.stack.hasFrontend ? `    ├──→ [FRONTEND-DEVELOPER]\n    │    • Componentes e páginas\n    │    • State management\n    │    • UX/UI\n    │\n` : ''}${this.stack.hasMobile ? `    ├──→ [FLUTTER-UI-DEVELOPER]\n    │    • Screens mobile\n    │    • Navigation\n    │    • Widgets\n    │\n` : ''}${this.stack.hasDatabase ? `    ├──→ [DATABASE-ENGINEER]\n    │    • Schema design\n    │    • Migrations\n    │    • Performance\n    │\n` : ''}    ├──→ [SECURITY-AUDITOR]
    │    • Análise de ameaças
    │    • Compliance check
    │
    ├──→ [QA-TEST-ENGINEER]
    │    • Test plan
    │    • Coverage targets
    │
    └──→ [TECH-DEBT-CONTROLLER]
         • Débito técnico existente
         • Refatorações pré-requisito
\`\`\`

### FASE 2: Consolidação

O orquestrador consolida em um plano com:
- Diagrama de arquitetura
- Cenários BDD
- Plano de testes
- Estimativa de esforço
- Riscos e mitigações

### FASE 3: Implementação

Após \`/approved\`, delegar em blocos ordenados por dependência.

---

## Quality Gates

\`\`\`
□ Testes passando
□ Build compilando
□ Score >= ${Math.max(this.report.score.overall, 70)}/100
□ Sem regressão de score
□ Code review aprovado
\`\`\`

---

**Gerado por Architect v2.1 · Score: ${this.report.score.overall}/100**
`;
  }

  private genBackendAgent(): string {
    const lang = this.stack.primary;
    const fw = this.stack.frameworks.filter(f =>
      ['Django', 'Flask', 'FastAPI', 'NestJS', 'Spring', 'Express'].includes(f)
    ).join(', ') || lang;

    return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*.${lang === 'Python' ? 'py' : 'ts'}']
  description: '${lang} Backend Developer — Arquitetura, APIs, serviços'
agent_card:
  id: '${lang.toLowerCase()}-backend'
  name: '${lang} Backend Developer'
  role: 'development'
  capabilities: [api-design, service-architecture, business-logic, data-modeling]
  inputs: [user-story, api-contracts, business-rules]
  outputs: [controllers, services, entities, migrations, tests]
  depends_on: [${this.stack.hasDatabase ? 'database-engineer' : ''}]
---

# 🔧 ${lang.toUpperCase()} BACKEND DEVELOPER

> Especialista em backend ${fw} para ${this.projectName}

## Stack

- **Linguagem:** ${lang}
- **Framework:** ${fw}
- **Teste:** ${this.stack.testFramework}
- **Package Manager:** ${this.stack.packageManager}

## Princípios

1. **SOLID** — Single Responsibility, Open/Closed, Liskov, Interface Segregation, Dependency Inversion
2. **Clean Architecture** — Separação de camadas
3. **DRY** — Don't Repeat Yourself
4. **KISS** — Keep It Simple
5. **Fail Fast** — Validação na entrada

## Padrões de Código

### Estrutura de Módulo

\`\`\`
src/modules/[nome]/
├── [nome].module.${lang === 'Python' ? 'py' : 'ts'}
├── [nome].controller.${lang === 'Python' ? 'py' : 'ts'}
├── [nome].service.${lang === 'Python' ? 'py' : 'ts'}
├── dto/
├── entities/
└── __tests__/
\`\`\`

### Convenções

| Item | Padrão | Exemplo |
|------|--------|---------|
| Classes | PascalCase | \`UserService\` |
| Funções | camelCase / snake_case | \`get_user\` / \`getUser\` |
| Constantes | UPPER_SNAKE | \`MAX_RETRIES\` |
| Arquivos | kebab-case | \`user-service.${lang === 'Python' ? 'py' : 'ts'}\` |

## Checklist por Entrega

\`\`\`
□ Tipos/interfaces definidos
□ Validação de entrada implementada
□ Erros tratados com mensagens claras
□ Testes unitários (mínimo 60%)
□ Sem secrets hardcoded
□ Logging adequado
□ Documentação de API
\`\`\`

---

**Gerado por Architect v2.1 · Score: ${this.report.score.overall}/100**
`;
  }

  private genFrontendAgent(): string {
    const fw = this.stack.frameworks.find(f =>
      ['Angular', 'Vue', 'Next.js', 'React'].includes(f)) || 'Frontend';

    return `---
antigravity:
  trigger: 'on_demand'
  globs: ['src/**/*.{ts,tsx,vue,html,css}']
  description: '${fw} Frontend Developer — Componentes, páginas, UX'
agent_card:
  id: 'frontend-developer'
  name: '${fw} Frontend Developer'
  role: 'development'
  capabilities: [component-design, state-management, responsive-ui, accessibility]
  inputs: [mockups, api-contracts, user-stories]
  outputs: [components, pages, services, styles, tests]
  depends_on: ['${this.stack.primary.toLowerCase()}-backend']
---

# 🎨 ${fw.toUpperCase()} FRONTEND DEVELOPER

> Especialista em frontend ${fw} para ${this.projectName}

## Princípios

1. **Component-Driven** — Componentes reutilizáveis
2. **Responsive First** — Mobile-first design
3. **Accessibility** — WCAG 2.1 AA compliance
4. **Performance** — Lazy loading, tree shaking

## Checklist

\`\`\`
□ Mockup HTML aprovado ANTES de codar
□ Componentes reutilizáveis
□ Estado gerenciado corretamente
□ Responsivo testado (mobile/tablet/desktop)
□ Loading states implementados
□ Error states implementados
□ Acessibilidade verificada
□ Performance otimizada
\`\`\`

---

**Gerado por Architect v2.1**
`;
  }

  private genMobileAgent(): string {
    return `---
antigravity:
  trigger: 'on_demand'
  globs: ['lib/**/*.dart']
  description: 'Flutter UI Developer — Screens, widgets, navigation'
agent_card:
  id: 'flutter-ui'
  name: 'Flutter UI Developer'
  role: 'development'
  capabilities: [screen-design, widget-composition, navigation, state-management]
  inputs: [mockups, api-contracts]
  outputs: [screens, widgets, blocs, tests]
  depends_on: ['${this.stack.primary.toLowerCase()}-backend']
---

# 📱 FLUTTER UI DEVELOPER

> Especialista em mobile Flutter para ${this.projectName}

## Padrões

- **State:** BLoC / Provider
- **Navigation:** GoRouter / Navigator 2.0
- **Architecture:** Clean Architecture
- **Tests:** flutter_test + integration_test

---

**Gerado por Architect v2.1**
`;
  }

  private genDatabaseAgent(): string {
    return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/migrations/**', '**/entities/**', '**/models/**']
  description: 'Database Engineer — Schema, migrations, performance'
agent_card:
  id: 'database-engineer'
  name: 'Database Engineer'
  role: 'development'
  capabilities: [schema-design, migrations, indexing, query-optimization]
  inputs: [business-rules, data-requirements]
  outputs: [migrations, entities, indexes, constraints]
  depends_on: []
---

# 🗄️ DATABASE ENGINEER

> Especialista em banco de dados para ${this.projectName}

## Regras

1. **NUNCA** usar DELETE físico — sempre soft delete
2. **SEMPRE** criar migration SQL (não ORM auto-generate)
3. **SEMPRE** adicionar indexes para FKs e campos de busca
4. **SEMPRE** validar constraints antes de deploy

---

**Gerado por Architect v2.1**
`;
  }

  private genSecurityAgent(): string {
    return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*']
  description: 'Security Auditor — Análise de vulnerabilidades e compliance'
agent_card:
  id: 'security-auditor'
  name: 'Security Auditor'
  role: 'protection'
  capabilities: [threat-modeling, vulnerability-scan, compliance-check, auth-review]
  inputs: [source-code, api-contracts, deployment-config]
  outputs: [security-reports, threat-models, compliance-checklists]
  depends_on: []
---

# 🛡️ SECURITY AUDITOR

> Proteção contra ameaças para ${this.projectName}

## Checklist de Segurança

\`\`\`
□ Sem secrets/credentials hardcoded
□ Sem logging de dados sensíveis (passwords, tokens, PII)
□ Inputs sanitizados
□ Queries parametrizadas (anti SQL injection)
□ Autenticação validada em todas as rotas
□ Autorização (RBAC) verificada
□ Rate limiting configurado
□ CORS configurado corretamente
□ Headers de segurança (HSTS, CSP, X-Frame)
□ Dependências sem vulnerabilidades conhecidas
\`\`\`

## STRIDE Threat Model

| Ameaça | Descrição | Mitigação |
|--------|-----------|-----------|
| **S**poofing | Falsificação de identidade | JWT + MFA |
| **T**ampering | Alteração de dados | Validação + Checksums |
| **R**epudiation | Negação de ações | Audit logs |
| **I**nformation Disclosure | Vazamento de dados | Encryption + RBAC |
| **D**enial of Service | Indisponibilidade | Rate limiting + WAF |
| **E**levation of Privilege | Escalação de permissões | RBAC + Least privilege |

---

**Gerado por Architect v2.1 · Score: ${this.report.score.overall}/100**
`;
  }

  private genQAAgent(): string {
    return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*.{test,spec}.*', '**/__tests__/**']
  description: 'QA Test Engineer — Testes, cobertura, qualidade'
agent_card:
  id: 'qa-test-engineer'
  name: 'QA Test Engineer'
  role: 'quality'
  capabilities: [bdd-specs, unit-tests, integration-tests, e2e-tests, coverage-analysis]
  inputs: [user-stories, api-contracts, business-rules]
  outputs: [test-suites, bdd-scenarios, coverage-reports]
  depends_on: []
---

# 🧪 QA TEST ENGINEER

> Qualidade e testes para ${this.projectName}

## Stack de Testes

- **Framework:** ${this.stack.testFramework}
- **Cobertura mínima:** 60%
- **Padrão:** TDD (Red → Green → Refactor)

## Fluxo TDD

\`\`\`
1. RED    → Escrever teste que FALHA
2. GREEN  → Código MÍNIMO para passar
3. REFACTOR → Limpar sem quebrar
\`\`\`

## Cenários Obrigatórios

\`\`\`
□ Happy path (fluxo principal)
□ Validação de entrada (dados inválidos)
□ Edge cases (limites, null, empty)
□ Erro handling (exceptions, timeouts)
□ Permissões (autorizado vs não autorizado)
□ Fluxos existentes NÃO quebrados
\`\`\`

## Padrão BDD

\`\`\`gherkin
Feature: [Nome]
  Scenario: [Happy Path]
    Given [contexto]
    When [ação]
    Then [resultado esperado]

  Scenario: [Erro]
    Given [contexto]
    When [ação inválida]
    Then [erro esperado]
\`\`\`

---

**Gerado por Architect v2.1**
`;
  }

  private genTechDebtAgent(): string {
    const steps = this.plan.steps.map(s =>
      `| ${s.priority} | ${s.title} | ${s.operations.length} ops |`
    ).join('\n');

    return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*']
  description: 'Tech Debt Controller — Identifica e prioriza débito técnico'
agent_card:
  id: 'tech-debt-controller'
  name: 'Tech Debt Controller'
  role: 'governance'
  capabilities: [debt-identification, refactoring-planning, pattern-enforcement]
  inputs: [architecture-report, anti-patterns, code-metrics]
  outputs: [debt-backlog, refactoring-plans, improvement-metrics]
  depends_on: []
---

# 📊 TECH DEBT CONTROLLER

> Governança de débito técnico para ${this.projectName}

## Estado Atual

- **Score:** ${this.report.score.overall}/100
- **Anti-patterns:** ${this.report.antiPatterns.length}
- **Refactoring steps:** ${this.plan.steps.length}

## Backlog de Refactoring

| Prioridade | Item | Operações |
|------------|------|-----------|
${steps || '| — | Nenhum item pendente | — |'}

## Taxonomia de Dívida

| Tipo | Descrição | Impacto |
|------|-----------|---------|
| Architecture | Violações de camadas, hubs | Score |
| Code Quality | Complexidade, duplicação | Manutenção |
| Testing | Cobertura baixa, sem testes | Confiabilidade |
| Security | Vulnerabilidades conhecidas | Risco |
| Documentation | Docs ausentes ou desatualizados | Onboarding |

---

**Gerado por Architect v2.1 · Score: ${this.report.score.overall}/100**
`;
  }

  private genGeneralRules(): string {
    return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'Regras gerais obrigatórias — ${this.projectName}'
---

# ${this.projectName} — Regras Gerais

> **LEIA TUDO ANTES DE QUALQUER AÇÃO.**

## 🥇 REGRAS DE OURO (INVIOLÁVEIS)

\`\`\`
🥇 1. GIT FLOW COMPLETO
   → Verificar branch + status ANTES de tudo
   → feature/* → develop → staging → main
   → NUNCA codificar direto em main/staging/develop

🥇 2. DIAGNÓSTICO ANTES DE CODAR
   → Ler código existente ANTES de implementar
   → Verificar se já existe algo similar

🥇 3. TDD
   → Testes ANTES do código
   → Red → Green → Refactor

🥇 4. NÃO DECIDIR SOZINHO
   → Dúvida? PARAR E PERGUNTAR

🥇 5. QUALIDADE > VELOCIDADE
   → Nunca atalhos. Fazer certo da primeira vez.
\`\`\`

## Stack

| Camada | Tecnologia |
|--------|------------|
${this.stack.languages.map(l => `| ${l} | ${this.stack.frameworks.filter(f => f).join(', ') || l} |`).join('\n')}

## Convenções de Idioma

| Contexto | Idioma |
|----------|--------|
| Código (variáveis, funções) | Inglês |
| Comentários | Português (Brasil) |
| Git commits | Inglês (Conventional Commits) |
| Documentação | Português (Brasil) |

## Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Classes | PascalCase | \`UserService\` |
| Funções | camelCase | \`getUser\` |
| Constantes | UPPER_SNAKE | \`MAX_RETRIES\` |
| Arquivos | kebab-case | \`user-service.ts\` |

## ⛔ O QUE NUNCA FAZER

\`\`\`
❌ Commitar em main/staging/develop
❌ Pular Git Flow
❌ Assumir — VERIFICAR
❌ Dizer "pronto" sem testes
❌ Hardcoded secrets
\`\`\`

---

**Gerado por Architect v2.1 · Score: ${this.report.score.overall}/100**
`;
  }

  private genArchitectureRules(): string {
    const layers = this.report.layers.map(l =>
      `| ${l.name} | ${l.files.length} files | ${l.description} |`
    ).join('\n');

    return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'Regras de arquitetura — ${this.projectName}'
---

# Regras de Arquitetura

## Camadas Detectadas

| Camada | Arquivos | Descrição |
|--------|----------|-----------|
${layers}

## Score Atual: ${this.report.score.overall}/100

| Métrica | Valor |
|---------|-------|
| Modularity | ${this.report.score.breakdown.modularity} |
| Coupling | ${this.report.score.breakdown.coupling} |
| Cohesion | ${this.report.score.breakdown.cohesion} |
| Layering | ${this.report.score.breakdown.layering} |

## Regras

1. **Respeitar camadas** — Nunca importar de camada superior
2. **Máximo 5 dependências** — Acima disso, considerar split
3. **Sem imports circulares** — Sempre unidirecional
4. **Um propósito por arquivo** — Single Responsibility

---

**Gerado por Architect v2.1**
`;
  }

  private genSecurityRules(): string {
    return `---
antigravity:
  trigger: 'always_on'
  globs: ['**/*']
  description: 'Regras de segurança — ${this.projectName}'
---

# Regras de Segurança

## NUNCA (Zero Tolerância)

\`\`\`
❌ Hardcoded secrets, API keys, passwords
❌ Logging de dados sensíveis (PII, tokens)
❌ SQL sem parameterização
❌ eval() ou exec() com input do usuário
❌ Endpoints sem autenticação
❌ CORS com wildcard (*) em produção
\`\`\`

## SEMPRE

\`\`\`
✅ Sanitizar inputs do usuário
✅ Usar queries parametrizadas
✅ Validar file uploads (tipo, tamanho)
✅ Rate limiting em APIs públicas
✅ Headers de segurança (HSTS, CSP)
✅ Audit logs para ações sensíveis
\`\`\`

---

**Gerado por Architect v2.1**
`;
  }

  private genStackRules(): string {
    const lang = this.stack.primary;
    return `---
antigravity:
  trigger: 'on_demand'
  globs: ['**/*.${lang === 'Python' ? 'py' : lang === 'TypeScript' ? 'ts' : lang.toLowerCase()}']
  description: 'Regras específicas de ${lang} — ${this.projectName}'
---

# Regras ${lang}

## Boas Práticas

${lang === 'Python' ? `
- Type hints em TODAS as funções
- Docstrings em classes e funções públicas
- PEP 8 compliance
- Use \`pathlib\` ao invés de \`os.path\`
- Use \`dataclasses\` ou \`pydantic\` para modelos
- Virtual environment obrigatório
` : lang === 'TypeScript' ? `
- Strict mode ativado
- Interfaces para TODOS os contratos
- Sem \`any\` (use \`unknown\` se necessário)
- Async/await ao invés de callbacks
- Enum ao invés de magic strings
- JSDoc em funções públicas
` : `
- Siga as convenções da linguagem
- Documentação obrigatória
- Testes unitários mínimo 60%
`}

---

**Gerado por Architect v2.1**
`;
  }

  private genPreflight(): string {
    return `# PREFLIGHT Checklist — ${this.projectName}

> **Execute ANTES de qualquer tarefa. Sem exceções.**

## 🔴 Fase 0: Preparação

\`\`\`
□ Li e entendi a tarefa completamente?
□ Sei qual é o objetivo?
□ Identifiquei o tipo: [ ] Backend  [ ] Frontend  [ ] Database  [ ] Bug Fix  [ ] Feature
\`\`\`

## 🔴 Fase 1: Ambiente

\`\`\`
□ Qual branch estou?     → git branch --show-current
□ É main ou develop?     → CRIAR BRANCH IMEDIATAMENTE
□ Branch atualizada?     → git pull origin develop
\`\`\`

## 🔴 Fase 2: Diagnóstico

\`\`\`
□ Verifiquei código existente similar?
□ Entendi a arquitetura afetada?
□ Li lessons-learned (se existir)?
\`\`\`

## ⚠️ Red Flags - PARE

| Red Flag | Ação |
|----------|------|
| Não sei onde fica o código | Pesquisar ANTES |
| Vou assumir algo | PERGUNTAR |
| Estou em main/develop | CRIAR BRANCH |
| "Acho que funciona" | TESTAR |

---

**Gerado por Architect v2.1**
`;
  }

  private genQualityGates(): string {
    const minScore = Math.max(this.report.score.overall - 5, 60);

    return `# Quality Gates — ${this.projectName}

> Score atual: **${this.report.score.overall}/100**

## Gates Obrigatórios

| Gate | Critério | Status |
|------|----------|--------|
| Build | Compila sem erros | ✅ Required |
| Lint | Sem erros de lint | ✅ Required |
| Tests | Todos passando | ✅ Required |
| Coverage | >= 60% | ✅ Required |
| Score | >= ${minScore}/100 | ✅ Required |
| No Regression | Score não pode cair | ⚠️ Warning |

## Métricas Atuais

| Métrica | Valor | Meta |
|---------|-------|------|
| Modularity | ${this.report.score.breakdown.modularity} | >= 80 |
| Coupling | ${this.report.score.breakdown.coupling} | >= 70 |
| Cohesion | ${this.report.score.breakdown.cohesion} | >= 80 |
| Layering | ${this.report.score.breakdown.layering} | >= 80 |

---

**Gerado por Architect v2.1**
`;
  }

  private genCodeReview(): string {
    return `# Code Review Checklist — ${this.projectName}

## Funcionalidade
\`\`\`
□ Resolve o problema descrito?
□ Edge cases tratados?
□ Erros tratados com mensagens claras?
\`\`\`

## Qualidade
\`\`\`
□ Código legível e bem nomeado?
□ Sem duplicação desnecessária?
□ Princípios SOLID respeitados?
□ Complexidade controlada?
\`\`\`

## Segurança
\`\`\`
□ Sem secrets hardcoded?
□ Inputs validados?
□ Queries parametrizadas?
\`\`\`

## Testes
\`\`\`
□ Testes unitários adicionados?
□ Cenários de erro testados?
□ Cobertura >= 60%?
\`\`\`

---

**Gerado por Architect v2.1**
`;
  }

  private genDevelopWorkflow(): string {
    return `---
name: develop
description: Fluxo completo de desenvolvimento — ${this.projectName}
---

# Workflow: Desenvolvimento Completo

## 🎯 FLUXO OBRIGATÓRIO

\`\`\`
0️⃣  GIT FLOW      → Criar feature branch
1️⃣  ENTENDIMENTO  → Perguntas de clarificação
2️⃣  DIAGNÓSTICO   → Verificar código existente
3️⃣  BDD           → Cenários Gherkin (APROVAÇÃO)
4️⃣  TDD RED       → Testes falhando
5️⃣  TDD GREEN     → Código mínimo
6️⃣  REFACTOR      → Código limpo
7️⃣  GIT COMMIT    → Conventional Commits + Push
\`\`\`

## Pontos de Aprovação

1. Após entendimento
2. Após cenários BDD
3. Após testes verdes
4. Após refatoração
5. Após commit e push

## 🚫 PROIBIDO

- ❌ Trabalhar direto em develop/main
- ❌ Código antes de teste
- ❌ Avançar sem aprovação
- ❌ Commit sem Conventional Commits

---

**Gerado por Architect v2.1**
`;
  }

  private genFixBugWorkflow(): string {
    return `---
name: fix-bug
description: Corrigir bug com diagnóstico completo — ${this.projectName}
---

# Workflow: Fix Bug

\`\`\`
1️⃣  Criar branch fix/nome-do-bug
2️⃣  Reproduzir o bug
3️⃣  Escrever teste que FALHA reproduzindo o bug
4️⃣  Corrigir o código mínimo
5️⃣  Teste passa (GREEN)
6️⃣  Verificar que não quebrou nada
7️⃣  Commit: fix(scope): description
\`\`\`

---

**Gerado por Architect v2.1**
`;
  }

  private genReviewWorkflow(): string {
    return `---
name: review
description: Code review completo — ${this.projectName}
---

# Workflow: Code Review

\`\`\`
1️⃣  Ler a descrição do PR
2️⃣  Verificar diff por arquivo
3️⃣  Executar checklist de review
4️⃣  Rodar testes localmente
5️⃣  Aprovar ou solicitar mudanças
\`\`\`

---

**Gerado por Architect v2.1**
`;
  }
}
