import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { AnalysisReport, RefactoringPlan } from "../../types.js";
import { StackInfo, AgentAuditFinding, AgentItem, AgentItemStatus, AgentSuggestion } from "../types.js";
import { StackDetector } from "../stack-detector.js";
import { ContextBuilder } from "./context-builder.js";
import { AuditEngine } from "./audit-engine.js";
import { getStackRuleFileName } from "../templates/stack/index.js";

export class SuggestionEngine {
  private stackDetector = new StackDetector();
  private contextBuilder = new ContextBuilder();
  private auditEngine = new AuditEngine();

  suggest(
    report: AnalysisReport,
    plan: RefactoringPlan,
    projectPath: string,
  ): AgentSuggestion {
    const cleanReport = this.contextBuilder.sanitizeReport(report);
    const stack = this.stackDetector.detect(cleanReport);
    const agentDir = join(projectPath, '.agent');
    const isExisting = existsSync(agentDir);

    const existingFiles = (subdir: string): Set<string> => {
      const dir = join(agentDir, subdir);
      if (!existsSync(dir)) return new Set();
      return new Set(readdirSync(dir).map(f => f.replace(/\.md$/, '')));
    };

    let audit: AgentAuditFinding[] = [];
    if (isExisting) {
      audit = this.auditEngine.auditExisting(agentDir, stack, report, plan);
    }

    const ctx = this.contextBuilder.buildContext(cleanReport, plan, stack, projectPath);

    const existingAgents = existingFiles('agents');
    const existingRules = existingFiles('rules');
    const existingGuards = existingFiles('guards');
    const existingWorkflows = existingFiles('workflows');
    const existingSkillsDir = join(agentDir, 'skills');
    const existingSkillNames = existsSync(existingSkillsDir)
      ? new Set(readdirSync(existingSkillsDir).filter(f => {
          try { return statSync(join(existingSkillsDir, f)).isDirectory(); } catch { return false; }
        }))
      : new Set<string>();

    const itemStatus = (name: string, existing: Set<string>): AgentItemStatus => {
      const found = [...existing].some(e => e.toLowerCase() === name.toLowerCase());
      if (!found) return 'CREATE';
      const hasImprovement = audit.some(
        f => f.file.toLowerCase().includes(name.toLowerCase()) && (f.type === 'IMPROVEMENT' || f.type === 'OUTDATED')
      );
      return hasImprovement ? 'MODIFY' : 'KEEP';
    };

    // ── Agent definitions ──
    const agentDefs: { name: string; desc: string }[] = [
      { name: 'AGENT-ORCHESTRATOR', desc: 'Centro de comando — decompõe requisições, enforça gates, coordena agentes' },
    ];
    if (stack.hasBackend) agentDefs.push({
      name: `${stack.primary.toUpperCase()}-BACKEND-DEVELOPER`,
      desc: `Especialista em ${stack.primary} — APIs, serviços, lógica de negócio, integration docs`,
    });
    if (stack.hasFrontend) {
      const FRONTEND_FWS = ['Angular', 'Vue', 'Vue.js', 'Next.js', 'React', 'Nuxt', 'Svelte', 'Remix'];
      const detectedFw = ctx.detectedFrameworks?.find(f => FRONTEND_FWS.includes(f.name));
      const fw = detectedFw?.name ||
        stack.frameworks.find(f => FRONTEND_FWS.includes(f)) || 'FRONTEND';
      agentDefs.push({
        name: `${fw.toUpperCase().replace('.', '').replace(/\s/g, '-')}-FRONTEND-DEVELOPER`,
        desc: `Componentes ${fw}, state management, UX responsiva, todos os estados UI`,
      });
    }
    if (stack.hasMobile) agentDefs.push({
      name: 'FLUTTER-UI-DEVELOPER',
      desc: 'Screens mobile, widgets, navegação, integração API, padrão visual do app',
    });
    if (stack.hasDatabase) agentDefs.push({
      name: 'DATABASE-ENGINEER',
      desc: 'Schema design, migrations reversíveis, indexação, performance de queries',
    });
    agentDefs.push(
      { name: 'SECURITY-AUDITOR', desc: 'OWASP Top 10, STRIDE threat model, compliance, vulnerabilidades' },
      { name: 'QA-TEST-ENGINEER', desc: 'BDD/TDD, cobertura mínima, planos de teste, regressão' },
      { name: 'TECH-DEBT-CONTROLLER', desc: 'Score tracking, anti-patterns, refatorações, metas de qualidade' },
    );

    const ruleDefs: { name: string; desc: string }[] = [
      { name: '00-general', desc: '9 Regras de Ouro, Git Flow, naming conventions, ações proibidas' },
      { name: '01-architecture', desc: 'Separação de camadas, dependency rules, padrões de módulo' },
      { name: '02-security', desc: 'Sanitização, secrets management, validação, OWASP' },
    ];
    const stackRuleName = getStackRuleFileName(ctx);
    if (stackRuleName) {
      const fwLabel = stack.frameworks[0] || stack.primary;
      ruleDefs.push({ name: stackRuleName, desc: `Regras específicas ${fwLabel} — patterns, anti-patterns, checklist` });
    }

    const guardDefs = [
      { name: 'PREFLIGHT', desc: '6-phase checklist pré-ação: ambiente → leitura → negócio → camada → commit → done' },
      { name: 'QUALITY-GATES', desc: '3 níveis (CRITICAL/IMPORTANT/DESIRABLE), métricas, blockers, verificação em 4 estágios' },
      { name: 'CODE-REVIEW-CHECKLIST', desc: 'Review em 6 dimensões: funcional, qualidade, testes, segurança, performance, arquitetura' },
    ];

    const workflowDefs = [
      { name: 'new-feature', desc: '10 steps com 6 approval gates, mockup-first, backend-first, integration doc' },
      { name: 'fix-bug', desc: '10 steps: diagnóstico → root cause → RED test → fix mínimo → regressão → docs' },
      { name: 'review', desc: 'Code review em 6 dimensões com checklist estruturado' },
    ];

    // Build items
    const suggestedAgents: AgentItem[] = agentDefs.map(({ name, desc }) => ({
      name, status: itemStatus(name, existingAgents), description: desc,
    }));
    for (const existing of existingAgents) {
      if (!agentDefs.some(d => d.name.toLowerCase() === existing.toLowerCase())) {
        suggestedAgents.push({ name: existing, status: 'KEEP', reason: 'Custom agent', description: 'Agente customizado do projeto' });
      }
    }

    const suggestedRules: AgentItem[] = ruleDefs.map(({ name, desc }) => ({
      name, status: itemStatus(name, existingRules), description: desc,
    }));
    for (const existing of existingRules) {
      if (!ruleDefs.some(d => d.name.toLowerCase() === existing.toLowerCase())) {
        suggestedRules.push({ name: existing, status: 'KEEP', reason: 'Custom rule' });
      }
    }

    const suggestedGuards: AgentItem[] = guardDefs.map(({ name, desc }) => ({
      name, status: itemStatus(name, existingGuards), description: desc,
    }));

    const suggestedWorkflows: AgentItem[] = workflowDefs.map(({ name, desc }) => ({
      name, status: itemStatus(name, existingWorkflows), description: desc,
    }));
    for (const existing of existingWorkflows) {
      if (!workflowDefs.some(d => d.name.toLowerCase() === existing.toLowerCase())) {
        suggestedWorkflows.push({ name: existing, status: 'KEEP', reason: 'Custom workflow' });
      }
    }

    // Skills
    const skillEntries = this.buildSkillEntries(stack, existingSkillNames);

    return {
      stack,
      hasExistingAgents: isExisting,
      suggestedAgents,
      suggestedRules,
      suggestedGuards,
      suggestedWorkflows,
      suggestedSkills: skillEntries,
      audit,
      command: `architect agents ${projectPath}`,
    };
  }

  public buildSkillEntries(stack: StackInfo, existing: Set<string>) {
    const entries: { name: string; source: string; description: string; status: AgentItemStatus }[] = [
      { name: 'test-driven-development', source: 'anthropic/courses/test-driven-development', description: 'TDD: Red → Green → Refactor', status: 'CREATE' },
      { name: 'systematic-debugging', source: 'anthropic/courses/systematic-debugging', description: 'Structured debugging methodology', status: 'CREATE' },
      { name: 'code-review', source: 'anthropic/courses/requesting-code-review', description: 'Code review best practices', status: 'CREATE' },
      { name: 'security-best-practices', source: 'anthropic/courses/security-best-practices', description: 'Security patterns and vulnerability prevention', status: 'CREATE' },
      { name: 'performance-optimization', source: 'anthropic/courses/performance-optimization', description: 'Performance analysis and optimization', status: 'CREATE' },
      { name: 'git-workflow', source: 'anthropic/courses/git-workflow', description: 'Git branching, commits, collaboration', status: 'CREATE' },
    ];

    // Stack-specific skills
    if (stack.languages.includes('TypeScript') || stack.languages.includes('JavaScript')) {
      entries.push({ name: 'api-design-principles', source: 'anthropic/courses/api-design-principles', description: 'REST/GraphQL API design', status: 'CREATE' });
    }
    if (stack.frameworks.includes('Angular') || stack.frameworks.includes('Vue') || stack.frameworks.includes('React') || stack.frameworks.includes('Next.js')) {
      entries.push(
        { name: 'frontend-design', source: 'anthropic/courses/frontend-design', description: 'Modern frontend patterns', status: 'CREATE' },
        { name: 'web-accessibility', source: 'anthropic/courses/web-accessibility', description: 'WCAG accessibility standards', status: 'CREATE' },
      );
    }
    if (stack.languages.includes('Dart') || stack.frameworks.includes('Flutter')) {
      entries.push({ name: 'flutter-animations', source: 'anthropic/courses/flutter-animations', description: 'Flutter animation patterns', status: 'CREATE' });
    }
    if (stack.languages.includes('Python')) {
      entries.push({ name: 'python-performance', source: 'anthropic/courses/python-performance-optimization', description: 'Python optimization and profiling', status: 'CREATE' });
    }
    if (stack.hasDatabase) {
      entries.push({ name: 'database-schema-design', source: 'anthropic/courses/database-schema-design', description: 'Schema design, indexing, migrations', status: 'CREATE' });
    }

    // Update status based on existing
    for (const entry of entries) {
      if (existing.has(entry.name)) entry.status = 'KEEP';
    }

    return entries;
  }
}
