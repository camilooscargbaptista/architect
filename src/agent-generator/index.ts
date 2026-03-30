import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import { AnalysisReport, RefactoringPlan } from '../types.js';
import {
  StackInfo,
  AgentAuditFinding,
  AgentItem,
  AgentItemStatus,
  AgentSuggestion,
  TemplateContext,
  EnrichedTemplateContext,
  DomainInsights,
  ModuleDetail,
  DetectedEndpoint,
  FrameworkInfo,
  DetectedToolchain,
  AgentGeneratorConfig,
  DEFAULT_AGENT_CONFIG,
} from './types.js';
import { StackDetector } from './stack-detector.js';
import { ContextEnricher } from './context-enricher.js';

// ── Core Templates (Enterprise-Grade) ──
import { generateIndexMd } from './templates/core/index-md.js';
import { generateOrchestrator } from './templates/core/orchestrator.js';
import { generatePreflight } from './templates/core/preflight.js';
import { generateQualityGates } from './templates/core/quality-gates.js';
import { generateGeneralRules } from './templates/core/general-rules.js';
import { generateArchitectureRules } from './templates/core/architecture-rules.js';
import { generateSecurityRules } from './templates/core/security-rules.js';
import { generateNewFeatureWorkflow } from './templates/core/workflow-new-feature.js';
import { generateFixBugWorkflow } from './templates/core/workflow-fix-bug.js';
import { generateReviewWorkflow } from './templates/core/workflow-review.js';
import {
  generateBackendAgent,
  generateFrontendAgent,
  generateSecurityAgent,
  generateQAAgent,
  generateTechDebtAgent,
  generateCodeReviewChecklist,
  generateDatabaseAgent,
  generateMobileAgent,
} from './templates/core/agents.js';

// ── Stack-Specific Templates ──
import { generateStackRules, getStackRuleFileName } from './templates/stack/index.js';

// ── Domain Templates ──
import {
  generateC4Template,
  generateBddTemplate,
  generateTddTemplate,
  generateAdrTemplate,
  generateThreatModelTemplate,
} from './templates/domain/index.js';

// ── Skills Generator ──
import { generateProjectSkills, generateArchitectIntegrationSkill, generateCIPipelineSkill, generateMonorepoGuideSkill } from './templates/core/skills-generator.js';

// ── Hooks Generator ──
import { generatePreCommitHook, generatePrePushHook, generatePostAnalysisHook } from './templates/core/hooks-generator.js';

// Re-export types for backward compatibility
export type { StackInfo, AgentAuditFinding, AgentItem, AgentItemStatus, AgentSuggestion, EnrichedTemplateContext, DomainInsights, ModuleDetail, DetectedEndpoint, FrameworkInfo, DetectedToolchain };

/**
 * Agent Generator v3.1 — Enterprise-Grade
 *
 * Generates or audits .agent/ directories with enterprise-grade
 * agent frameworks: detailed workflows, approval gates, quality enforcement,
 * stack-specific agents, and domain templates.
 */
export class AgentGenerator {
  private stackDetector = new StackDetector();
  private contextEnricher = new ContextEnricher();

  /** Max lines for any single generated .agent file */
  private static readonly MAX_FILE_LINES = 500;

  /** Paths that indicate third-party code — filter from agent context */
  private static readonly EXCLUDED_SEGMENTS = [
    'node_modules', '/dist/', '/build/', '/coverage/',
    '/.next/', '/venv/', '/__pycache__/', '/target/',
  ];

  /**
   * Sanitize the report before passing to agent generation.
   * Removes anti-patterns, dependency nodes, and suggestions
   * that reference node_modules or build artifacts.
   */
  private sanitizeReport(report: AnalysisReport): AnalysisReport {
    const isProjectPath = (path: string): boolean => {
      const normalized = path.replace(/\\/g, '/');
      return !AgentGenerator.EXCLUDED_SEGMENTS.some(seg => normalized.includes(seg));
    };

    return {
      ...report,
      antiPatterns: report.antiPatterns.filter(ap => {
        if (!isProjectPath(ap.location)) return false;
        if (ap.affectedFiles?.some(f => !isProjectPath(f))) {
          // Keep the pattern but clean affected files
          ap.affectedFiles = ap.affectedFiles.filter(f => isProjectPath(f));
        }
        return true;
      }),
      dependencyGraph: {
        nodes: report.dependencyGraph.nodes.filter(n => isProjectPath(n)),
        edges: report.dependencyGraph.edges.filter(
          e => isProjectPath(e.from) && isProjectPath(e.to)
        ),
      },
      suggestions: report.suggestions.filter(
        s => !s.description.includes('node_modules')
      ),
    };
  }

  /**
   * Cap content to max lines to prevent oversized agent files.
   */
  private capContent(content: string): string {
    const lines = content.split('\n');
    if (lines.length <= AgentGenerator.MAX_FILE_LINES) return content;

    const truncated = lines.slice(0, AgentGenerator.MAX_FILE_LINES);
    truncated.push('');
    truncated.push('<!-- Content truncated at ' + AgentGenerator.MAX_FILE_LINES + ' lines. Run `architect agents` to regenerate. -->');
    return truncated.join('\n');
  }

  /**
   * Suggest agents without writing files — for unified report.
   */
  suggest(
    report: AnalysisReport,
    plan: RefactoringPlan,
    projectPath: string,
  ): AgentSuggestion {
    const cleanReport = this.sanitizeReport(report);
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
      audit = this.auditExisting(agentDir, stack, report, plan);
    }

    const ctx = this.buildContext(cleanReport, plan, stack, projectPath);

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

  /**
   * Generate or audit .agent/ directory for a project.
   */
  generate(
    report: AnalysisReport,
    plan: RefactoringPlan,
    projectPath: string,
    outputDir?: string
  ): { generated: string[]; audit: AgentAuditFinding[] } {
    const cleanReport = this.sanitizeReport(report);
    const stack = this.stackDetector.detect(cleanReport);
    const agentDir = outputDir || join(projectPath, '.agent');
    const isExisting = existsSync(agentDir);

    if (isExisting) {
      const audit = this.auditExisting(agentDir, stack, cleanReport, plan);
      const generated = this.generateMissing(agentDir, audit, cleanReport, plan, stack, projectPath);
      return { generated, audit };
    }

    const generated = this.generateFull(agentDir, cleanReport, plan, stack, projectPath);
    return { generated, audit: [] };
  }

  // ── Private: Build Template Context ──

  private buildContext(report: AnalysisReport, plan: RefactoringPlan, stack: StackInfo, projectPath?: string): EnrichedTemplateContext {
    if (projectPath) {
      return this.contextEnricher.enrich(report, plan, stack, projectPath);
    }
    // Fallback to basic enriched context for backward compatibility
    return {
      report,
      plan,
      stack,
      projectName: report.projectInfo.name || 'Project',
      stackLabel: [...stack.languages, ...stack.frameworks].join(' + '),
      config: DEFAULT_AGENT_CONFIG,
      domain: {
        domain: 'general',
        subDomain: 'general',
        description: '',
        businessEntities: [],
        compliance: [],
        integrations: [],
        keywords: [],
        confidence: 0,
      },
      modules: [],
      endpoints: [],
      untestedModules: [],
      criticalPaths: [],
      projectDepth: 'small',
      detectedFrameworks: [],
      primaryFramework: null,
      toolchain: {
        buildCmd: 'echo "No build command detected"',
        testCmd: 'echo "No test command detected"',
        lintCmd: 'echo "No lint command detected"',
        runCmd: 'echo "No run command detected"',
        coverageCmd: 'echo "No coverage command detected"',
        installCmd: 'echo "No install command detected"',
        migrateCmd: null,
        depsFile: 'unknown',
      },
      projectStructure: 'unknown',
    };
  }

  // ── Private: Full Generation ──

  private generateFull(agentDir: string, report: AnalysisReport, plan: RefactoringPlan, stack: StackInfo, projectPath: string): string[] {
    const generated: string[] = [];
    const ctx = this.buildContext(report, plan, stack, projectPath);

    // Create directories
    const dirs = ['agents', 'rules', 'guards', 'workflows', 'templates', 'skills', 'hooks'];
    for (const d of dirs) mkdirSync(join(agentDir, d), { recursive: true });

    // ── Core files (Enterprise-Grade) ──
    const coreFiles: Record<string, string> = {
      'INDEX.md': generateIndexMd(ctx),
      'agents/AGENT-ORCHESTRATOR.md': generateOrchestrator(ctx),
      'guards/PREFLIGHT.md': generatePreflight(ctx),
      'guards/QUALITY-GATES.md': generateQualityGates(ctx),
      'guards/CODE-REVIEW-CHECKLIST.md': generateCodeReviewChecklist(ctx),
      'rules/00-general.md': generateGeneralRules(ctx),
      'rules/01-architecture.md': generateArchitectureRules(ctx),
      'rules/02-security.md': generateSecurityRules(ctx),
      'workflows/new-feature.md': generateNewFeatureWorkflow(ctx),
      'workflows/fix-bug.md': generateFixBugWorkflow(ctx),
      'workflows/review.md': generateReviewWorkflow(ctx),
    };

    // ── Stack-specific agents ──
    if (stack.hasBackend) {
      coreFiles[`agents/${stack.primary.toUpperCase()}-BACKEND-DEVELOPER.md`] = generateBackendAgent(ctx);
    }
    if (stack.hasFrontend) {
      const FRONTEND_FWS = ['Angular', 'Vue', 'Vue.js', 'Next.js', 'React', 'Nuxt', 'Svelte', 'Remix'];
      const detectedFw = ctx.detectedFrameworks?.find(f => FRONTEND_FWS.includes(f.name));
      const fwName = detectedFw?.name ||
        stack.frameworks.find(f => FRONTEND_FWS.includes(f)) || 'Frontend';
      coreFiles[`agents/${fwName.toUpperCase().replace('.', '').replace(/\s/g, '-')}-FRONTEND-DEVELOPER.md`] = generateFrontendAgent(ctx);
    }
    if (stack.hasMobile) {
      coreFiles['agents/FLUTTER-UI-DEVELOPER.md'] = generateMobileAgent(ctx);
    }
    if (stack.hasDatabase) {
      coreFiles['agents/DATABASE-ENGINEER.md'] = generateDatabaseAgent(ctx);
    }
    coreFiles['agents/SECURITY-AUDITOR.md'] = generateSecurityAgent(ctx);
    coreFiles['agents/QA-TEST-ENGINEER.md'] = generateQAAgent(ctx);
    coreFiles['agents/TECH-DEBT-CONTROLLER.md'] = generateTechDebtAgent(ctx);

    // ── Stack-specific rules ──
    const stackRuleContent = generateStackRules(ctx);
    const stackRuleFile = getStackRuleFileName(ctx);
    if (stackRuleContent && stackRuleFile) {
      coreFiles[`rules/${stackRuleFile}.md`] = stackRuleContent;
    }

    // ── Domain templates ──
    coreFiles['templates/C4.md'] = generateC4Template(ctx);
    coreFiles['templates/BDD.md'] = generateBddTemplate(ctx);
    coreFiles['templates/TDD.md'] = generateTddTemplate(ctx);
    coreFiles['templates/ADR.md'] = generateAdrTemplate(ctx);
    coreFiles['templates/THREAT-MODEL.md'] = generateThreatModelTemplate(ctx);

    // ── Project Skills (padrões detectados) ──
    const skillsContent = generateProjectSkills(ctx);
    if (skillsContent) {
      coreFiles['skills/PROJECT-PATTERNS.md'] = skillsContent;
    }

    // ── Data-driven Skills (real project data) ──
    coreFiles['skills/ARCHITECT-INTEGRATION.md'] = generateArchitectIntegrationSkill(ctx);
    coreFiles['skills/CI-PIPELINE.md'] = generateCIPipelineSkill(ctx);

    const monorepoGuide = generateMonorepoGuideSkill(ctx);
    if (monorepoGuide) {
      coreFiles['skills/MONOREPO-GUIDE.md'] = monorepoGuide;
    }

    // ── Executable Hooks ──
    coreFiles['hooks/pre-commit.sh'] = generatePreCommitHook(ctx);
    coreFiles['hooks/pre-push.sh'] = generatePrePushHook(ctx);
    coreFiles['hooks/post-analysis.sh'] = generatePostAnalysisHook(ctx);

    // ── Write all files (with size cap) ──
    for (const [path, content] of Object.entries(coreFiles)) {
      const fullPath = join(agentDir, path);
      const dir = join(fullPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, this.capContent(content));
      generated.push(path);
    }

    return generated;
  }

  // ── Private: Generate Missing (for existing .agent/) ──

  private generateMissing(
    agentDir: string,
    audit: AgentAuditFinding[],
    report: AnalysisReport,
    plan: RefactoringPlan,
    stack: StackInfo,
    projectPath: string,
  ): string[] {
    const generated: string[] = [];
    const missing = audit.filter(f => f.type === 'MISSING');
    const ctx = this.buildContext(report, plan, stack, projectPath);

    for (const finding of missing) {
      const fullPath = join(agentDir, finding.file);
      const dir = join(fullPath, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const content = this.getTemplateFor(finding.file, ctx);
      if (content) {
        writeFileSync(fullPath, content);
        generated.push(finding.file);
      }
    }

    return generated;
  }

  private getTemplateFor(file: string, ctx: EnrichedTemplateContext): string | null {
    if (file.includes('INDEX')) return generateIndexMd(ctx);
    if (file.includes('ORCHESTRATOR')) return generateOrchestrator(ctx);
    if (file.includes('PREFLIGHT')) return generatePreflight(ctx);
    if (file.includes('QUALITY-GATES')) return generateQualityGates(ctx);
    if (file.includes('CODE-REVIEW')) return generateCodeReviewChecklist(ctx);
    if (file.includes('SECURITY')) return generateSecurityAgent(ctx);
    if (file.includes('QA')) return generateQAAgent(ctx);
    if (file.includes('TECH-DEBT')) return generateTechDebtAgent(ctx);
    if (file.includes('BACKEND')) return generateBackendAgent(ctx);
    if (file.includes('FRONTEND')) return generateFrontendAgent(ctx);
    if (file.includes('FLUTTER')) return generateMobileAgent(ctx);
    if (file.includes('DATABASE')) return generateDatabaseAgent(ctx);
    if (file.includes('00-general')) return generateGeneralRules(ctx);
    if (file.includes('01-architecture')) return generateArchitectureRules(ctx);
    if (file.includes('02-security')) return generateSecurityRules(ctx);
    if (file.includes('03-')) return generateStackRules(ctx);
    if (file.includes('new-feature') || file.includes('develop')) return generateNewFeatureWorkflow(ctx);
    if (file.includes('fix-bug')) return generateFixBugWorkflow(ctx);
    if (file.includes('review')) return generateReviewWorkflow(ctx);
    if (file.includes('C4')) return generateC4Template(ctx);
    if (file.includes('BDD')) return generateBddTemplate(ctx);
    if (file.includes('TDD')) return generateTddTemplate(ctx);
    if (file.includes('ADR')) return generateAdrTemplate(ctx);
    if (file.includes('THREAT')) return generateThreatModelTemplate(ctx);
    return null;
  }

  // ── Private: Audit ──

  private auditExisting(
    agentDir: string,
    stack: StackInfo,
    report: AnalysisReport,
    plan: RefactoringPlan,
  ): AgentAuditFinding[] {
    const findings: AgentAuditFinding[] = [];

    const checkExists = (subpath: string, category: string, desc: string): void => {
      const full = join(agentDir, subpath);
      if (!existsSync(full)) {
        findings.push({ type: 'MISSING', category, file: subpath, description: desc });
      } else {
        findings.push({ type: 'OK', category, file: subpath, description: `${subpath} exists` });
      }
    };

    // Core structure
    checkExists('INDEX.md', 'core', 'Master navigation guide');
    checkExists('agents/AGENT-ORCHESTRATOR.md', 'agents', 'Orchestrator agent with approval gates');
    checkExists('rules/00-general.md', 'rules', 'Golden rules and conventions');
    checkExists('rules/01-architecture.md', 'rules', 'Layer rules, dependency direction, module patterns');
    checkExists('rules/02-security.md', 'rules', 'OWASP, input validation, secrets management');
    checkExists('guards/PREFLIGHT.md', 'guards', '6-phase preflight checklist');
    checkExists('guards/QUALITY-GATES.md', 'guards', '3-level quality gates');
    checkExists('guards/CODE-REVIEW-CHECKLIST.md', 'guards', 'Structured code review checklist');
    checkExists('workflows/new-feature.md', 'workflows', '10-step feature workflow with approval gates');
    checkExists('workflows/fix-bug.md', 'workflows', 'Diagnostic bug fix workflow');

    // Domain templates
    checkExists('templates/C4.md', 'templates', 'C4 architecture template');
    checkExists('templates/BDD.md', 'templates', 'BDD scenario template');
    checkExists('templates/TDD.md', 'templates', 'TDD test template');
    checkExists('templates/ADR.md', 'templates', 'ADR decision record template');
    checkExists('templates/THREAT-MODEL.md', 'templates', 'STRIDE threat model template');

    // Stack-specific agents
    if (stack.hasBackend) {
      const found = this.findAgentByRole(agentDir, 'backend');
      if (!found) {
        findings.push({
          type: 'MISSING', category: 'agents',
          file: `agents/${stack.primary.toUpperCase()}-BACKEND-DEVELOPER.md`,
          description: `No backend developer agent for ${stack.primary}`,
        });
      }
    }
    if (stack.hasFrontend) {
      const found = this.findAgentByRole(agentDir, 'frontend');
      if (!found) {
        findings.push({
          type: 'MISSING', category: 'agents',
          file: 'agents/FRONTEND-DEVELOPER.md',
          description: 'No frontend developer agent',
        });
      }
    }

    // Quality improvements
    if (plan.steps.length > 0) {
      const found = this.findAgentByRole(agentDir, 'tech-debt');
      if (!found) {
        findings.push({
          type: 'IMPROVEMENT', category: 'agents',
          file: 'agents/TECH-DEBT-CONTROLLER.md',
          description: `${plan.steps.length} refactoring steps found but no Tech Debt agent`,
          suggestion: 'Create a Tech Debt Controller to track and prioritize refactoring',
        });
      }
    }

    if (report.score.overall < 80) {
      findings.push({
        type: 'IMPROVEMENT', category: 'guards',
        file: 'guards/QUALITY-GATES.md',
        description: `Score is ${report.score.overall}/100 — quality gates should enforce improvement`,
        suggestion: `Set minimum score threshold to ${report.score.overall + 5} and add regression guards`,
      });
    }

    return findings;
  }

  private findAgentByRole(agentDir: string, role: string): string | null {
    const dir = join(agentDir, 'agents');
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir);
    for (const file of files) {
      const content = readFileSync(join(dir, file), 'utf-8').toLowerCase();
      if (content.includes(role)) return file;
    }
    return null;
  }

  // ── Private: Skills ──

  private buildSkillEntries(stack: StackInfo, existing: Set<string>) {
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
