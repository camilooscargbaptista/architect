import { TemplateContext } from '../src/core/agent-generator/types/template.js';
import { StackInfo } from '../src/core/agent-generator/types/stack.js';
import { DEFAULT_AGENT_CONFIG } from '../src/core/agent-generator/types/agent.js';
import { AnalysisReport } from '../src/core/types/core.js';
import { RefactoringPlan } from '../src/core/types/rules.js';
import { generateIndexMd } from '../src/core/agent-generator/templates/core/index-md.js';
import { generateOrchestrator } from '../src/core/agent-generator/templates/core/orchestrator.js';
import { generatePreflight } from '../src/core/agent-generator/templates/core/preflight.js';
import { generateQualityGates } from '../src/core/agent-generator/templates/core/quality-gates.js';
import { generateGeneralRules } from '../src/core/agent-generator/templates/core/general-rules.js';
import { generateArchitectureRules } from '../src/core/agent-generator/templates/core/architecture-rules.js';
import { generateSecurityRules } from '../src/core/agent-generator/templates/core/security-rules.js';
import { generateNewFeatureWorkflow } from '../src/core/agent-generator/templates/core/workflow-new-feature.js';
import { generateFixBugWorkflow } from '../src/core/agent-generator/templates/core/workflow-fix-bug.js';
import { generateReviewWorkflow } from '../src/core/agent-generator/templates/core/workflow-review.js';
import { generateBackendAgent, generateFrontendAgent, generateSecurityAgent, generateQAAgent, generateTechDebtAgent, generateCodeReviewChecklist, generateDatabaseAgent, generateMobileAgent } from '../src/core/agent-generator/templates/core/agents.js';
import { generateC4Template, generateBddTemplate, generateTddTemplate, generateAdrTemplate, generateThreatModelTemplate } from '../src/core/agent-generator/templates/domain/index.js';
import { generateStackRules, getStackRuleFileName } from '../src/core/agent-generator/templates/stack/index.js';

// ── Core Templates ──












// ── Domain Templates ──


// ── Stack Templates ──


// ── Helpers ──

function makeStack(overrides: Partial<StackInfo> = {}): StackInfo {
  return {
    primary: 'TypeScript',
    languages: ['TypeScript'],
    frameworks: ['NestJS'],
    hasBackend: true,
    hasFrontend: false,
    hasMobile: false,
    hasDatabase: true,
    testFramework: 'Jest',
    packageManager: 'npm',
    ...overrides,
  };
}

function makeReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      path: '/test',
      name: 'test-project',
      frameworks: ['NestJS'],
      totalFiles: 50,
      totalLines: 5000,
      primaryLanguages: ['TypeScript'],
    },
    score: {
      overall: 72,
      components: [],
      breakdown: { modularity: 80, coupling: 65, cohesion: 70, layering: 75 },
    },
    antiPatterns: [
      {
        name: 'God Class',
        severity: 'CRITICAL',
        location: 'src/AppService.ts',
        description: 'Class with 800 lines',
        suggestion: 'Split into smaller services',
        affectedFiles: ['src/AppService.ts'],
      },
    ],
    layers: [
      { name: 'API', files: ['src/controller.ts'], description: 'API layer' },
      { name: 'Service', files: ['src/service.ts'], description: 'Service layer' },
    ],
    dependencyGraph: {
      nodes: ['src/controller.ts', 'src/service.ts'],
      edges: [{ from: 'src/controller.ts', to: 'src/service.ts', type: 'import', weight: 1 }],
    },
    suggestions: [],
    diagram: { mermaid: '', type: 'layer' },
    ...overrides,
  };
}

function makePlan(overrides: Partial<RefactoringPlan> = {}): RefactoringPlan {
  return {
    timestamp: new Date().toISOString(),
    projectPath: '/test',
    currentScore: {
      overall: 72,
      components: [],
      breakdown: { modularity: 80, coupling: 65, cohesion: 70, layering: 75 },
    },
    estimatedScoreAfter: { overall: 82, breakdown: { modularity: 85, coupling: 75, cohesion: 80, layering: 80 } },
    steps: [
      {
        id: 1,
        tier: 1,
        rule: 'hub-splitter',
        priority: 'HIGH',
        title: 'Split AppService',
        description: 'Split into smaller services',
        rationale: 'Reduce God Class',
        operations: [],
        scoreImpact: [{ metric: 'modularity', before: 80, after: 85 }],
      },
    ],
    totalOperations: 1,
    tier1Steps: 1,
    tier2Steps: 0,
    ...overrides,
  };
}

function makeCtx(stackOverrides: Partial<StackInfo> = {}, reportOverrides: Partial<AnalysisReport> = {}): TemplateContext {
  const stack = makeStack(stackOverrides);
  const report = makeReport(reportOverrides);
  const plan = makePlan();
  return {
    report,
    plan,
    stack,
    projectName: 'test-project',
    stackLabel: [...stack.languages, ...stack.frameworks].join(' + '),
    config: DEFAULT_AGENT_CONFIG,
  };
}

// ──────────────────────────────────────────────────

describe('Core Templates', () => {
  const ctx = makeCtx();

  describe('INDEX.md', () => {
    const output = generateIndexMd(ctx);

    it('should contain header and project info', () => {
      expect(output).toContain('Agent Framework');
      expect(output).toContain('Architect v3.1');
    });

    it('should contain project name', () => {
      expect(output).toContain('test-project');
    });

    it('should list mandatory reading order', () => {
      expect(output).toContain('00-general');
      expect(output).toContain('QUALITY-GATES');
    });

    it('should reference Architect plugin', () => {
      expect(output).toMatch(/architect/i);
    });
  });

  describe('ORCHESTRATOR', () => {
    const output = generateOrchestrator(ctx);

    it('should contain REGRA ABSOLUTA', () => {
      expect(output).toContain('REGRA ABSOLUTA');
    });

    it('should contain approval gates', () => {
      expect(output).toMatch(/gate|aprovação|approval/i);
    });

    it('should contain business questions', () => {
      expect(output).toMatch(/Q\d/);
    });

    it('should be substantial (Enterprise-Grade)', () => {
      expect(output.length).toBeGreaterThan(2000);
    });
  });

  describe('PREFLIGHT', () => {
    const output = generatePreflight(ctx);

    it('should contain multiple phases', () => {
      expect(output).toMatch(/Phase|Fase|FASE/);
    });

    it('should contain environment verification commands', () => {
      expect(output).toMatch(/npm|npx|node/);
    });

    it('should contain red flags', () => {
      expect(output).toMatch(/red flag|PARAR|STOP/i);
    });
  });

  describe('QUALITY-GATES', () => {
    const output = generateQualityGates(ctx);

    it('should contain 3 gate levels', () => {
      expect(output).toContain('CRITICAL');
      expect(output).toContain('IMPORTANT');
      expect(output).toContain('DESIRABLE');
    });

    it('should contain coverage threshold', () => {
      expect(output).toContain(`${DEFAULT_AGENT_CONFIG.coverageMinimum}%`);
    });

    it('should contain blockers', () => {
      expect(output).toContain('console.log');
    });
  });

  describe('00-general', () => {
    const output = generateGeneralRules(ctx);

    it('should contain golden rules', () => {
      expect(output).toContain('Regras de Ouro');
      expect(output).toContain('Git Flow');
    });

    it('should contain naming conventions', () => {
      expect(output).toMatch(/naming|convention|nomenclatura/i);
    });

    it('should contain forbidden actions', () => {
      expect(output).toMatch(/proibid|forbidden/i);
    });
  });

  describe('01-architecture', () => {
    const output = generateArchitectureRules(ctx);

    it('should contain layer rules table', () => {
      expect(output).toContain('Camada');
      expect(output).toContain('Responsabilidade');
    });

    it('should contain NestJS-specific patterns for NestJS stack', () => {
      expect(output).toContain('NestJS');
      expect(output).toContain('@Controller');
    });

    it('should contain dependency direction', () => {
      expect(output).toContain('Direção de Dependência');
    });

    it('should contain anti-patterns section', () => {
      expect(output).toContain('God Class');
      expect(output).toContain('Circular');
    });

    it('should contain project anti-patterns from report', () => {
      expect(output).toContain('AppService');
    });

    it('should contain architecture checklist', () => {
      expect(output).toContain('Checklist');
    });
  });

  describe('01-architecture (Python stack)', () => {
    const pythonCtx = makeCtx({
      primary: 'Python',
      languages: ['Python'],
      frameworks: ['Django'],
    });
    const output = generateArchitectureRules(pythonCtx);

    it('should contain Python-specific layer rules', () => {
      expect(output).toContain('Python');
      expect(output).toContain('views.py');
    });
  });

  describe('02-security', () => {
    const output = generateSecurityRules(ctx);

    it('should contain OWASP Top 10', () => {
      expect(output).toContain('OWASP');
      expect(output).toContain('A01');
      expect(output).toContain('A10');
    });

    it('should contain REGRA ZERO', () => {
      expect(output).toContain('REGRA ZERO');
    });

    it('should contain validation patterns', () => {
      expect(output).toContain('Validação de Input');
    });

    it('should contain NestJS validation for NestJS stack', () => {
      expect(output).toContain('class-validator');
      expect(output).toContain('ValidationPipe');
    });

    it('should contain secrets management', () => {
      expect(output).toContain('Secrets');
      expect(output).toContain('.env');
      expect(output).toContain('.gitignore');
    });

    it('should contain STRIDE', () => {
      expect(output).toContain('STRIDE');
    });

    it('should contain security checklist per layer', () => {
      expect(output).toContain('Controller');
      expect(output).toContain('Service');
      expect(output).toContain('Data');
    });
  });

  describe('02-security (Python stack)', () => {
    const pythonCtx = makeCtx({
      primary: 'Python',
      languages: ['Python'],
      frameworks: ['FastAPI'],
    });
    const output = generateSecurityRules(pythonCtx);

    it('should contain Python validation patterns', () => {
      expect(output).toContain('Pydantic');
    });

    it('should contain Python audit commands', () => {
      expect(output).toContain('pip audit');
    });
  });
});

describe('Workflow Templates', () => {
  const ctx = makeCtx();

  describe('new-feature', () => {
    const output = generateNewFeatureWorkflow(ctx);

    it('should contain 10 steps', () => {
      // Check for step markers
      const stepMatches = output.match(/step|passo|fase/gi);
      expect(stepMatches).toBeTruthy();
      expect(stepMatches!.length).toBeGreaterThan(5);
    });

    it('should contain approval gates', () => {
      expect(output).toMatch(/aprov|gate|humano/i);
    });

    it('should contain integration document requirement', () => {
      expect(output).toMatch(/integração|integration/i);
    });
  });

  describe('fix-bug', () => {
    const output = generateFixBugWorkflow(ctx);

    it('should contain diagnostic approach', () => {
      expect(output).toMatch(/diagnós|root cause|5 why/i);
    });

    it('should contain RED test requirement', () => {
      expect(output).toMatch(/RED|teste.*falha/i);
    });
  });

  describe('review', () => {
    const output = generateReviewWorkflow(ctx);

    it('should contain review dimensions', () => {
      expect(output).toContain('Funcional');
      expect(output).toMatch(/Qualidade|Quality/);
      expect(output).toMatch(/Segurança|Security/);
    });
  });
});

describe('Agent Templates', () => {
  const ctx = makeCtx();

  describe('Backend Agent', () => {
    const output = generateBackendAgent(ctx);

    it('should reference the detected stack', () => {
      expect(output).toContain('TypeScript');
    });

    it('should contain SOLID principles', () => {
      expect(output).toContain('SOLID');
      expect(output).toContain('Single Responsibility');
    });

    it('should require integration document', () => {
      expect(output).toMatch(/integração|integration/i);
    });

    it('should contain coverage gate', () => {
      expect(output).toContain(`${DEFAULT_AGENT_CONFIG.coverageMinimum}%`);
    });
  });

  describe('Frontend Agent', () => {
    const frontendCtx = makeCtx({
      hasFrontend: true,
      frameworks: ['Angular'],
    });
    const output = generateFrontendAgent(frontendCtx);

    it('should require mockup approval', () => {
      expect(output).toMatch(/mockup|MOCKUP/i);
    });

    it('should require all UI states', () => {
      expect(output).toContain('loading');
      expect(output).toContain('error');
      expect(output).toContain('empty');
    });
  });

  describe('Security Agent', () => {
    const output = generateSecurityAgent(ctx);

    it('should contain OWASP checklist', () => {
      expect(output).toContain('OWASP');
    });
  });

  describe('QA Agent', () => {
    const output = generateQAAgent(ctx);

    it('should contain coverage requirement', () => {
      expect(output).toContain(`${DEFAULT_AGENT_CONFIG.coverageMinimum}%`);
    });

    it('should contain test pyramid', () => {
      expect(output).toMatch(/pirâmide|pyramid/i);
    });

    it('should contain BDD/TDD process', () => {
      expect(output).toContain('BDD');
      expect(output).toContain('TDD');
    });
  });

  describe('Tech Debt Agent', () => {
    const output = generateTechDebtAgent(ctx);

    it('should contain current score', () => {
      expect(output).toContain('72/100');
    });

    it('should contain anti-patterns from report', () => {
      expect(output).toContain('God Class');
    });

    it('should prevent score regression', () => {
      expect(output).toMatch(/regre|NUNCA.*pode.*regredir/i);
    });
  });

  describe('Database Agent', () => {
    const output = generateDatabaseAgent(ctx);

    it('should contain migration rules', () => {
      expect(output).toMatch(/migration|migração/i);
    });

    it('should contain indexing rules', () => {
      expect(output).toMatch(/índice|index/i);
    });
  });

  describe('Mobile Agent', () => {
    const mobileCtx = makeCtx({
      primary: 'Dart',
      languages: ['Dart'],
      frameworks: ['Flutter'],
      hasMobile: true,
    });
    const output = generateMobileAgent(mobileCtx);

    it('should be Flutter-specific', () => {
      expect(output).toContain('Flutter');
    });

    it('should require all states', () => {
      expect(output).toContain('loading');
      expect(output).toContain('error');
      expect(output).toContain('empty');
    });
  });

  describe('Code Review Checklist', () => {
    const output = generateCodeReviewChecklist(ctx);

    it('should contain mandatory section', () => {
      expect(output).toContain('Obrigatório');
    });

    it('should contain security section', () => {
      expect(output).toMatch(/Segurança|Security/);
    });
  });
});

describe('Domain Templates', () => {
  it('C4 template should contain 4 levels', () => {
    const output = generateC4Template();
    expect(output).toContain('Contexto');
    expect(output).toContain('Container');
    expect(output).toContain('Componente');
    expect(output).toContain('Código');
  });

  it('BDD template should contain Gherkin format', () => {
    const output = generateBddTemplate();
    expect(output).toMatch(/Given|Dado/i);
    expect(output).toMatch(/When|Quando/i);
    expect(output).toMatch(/Then|Então/i);
  });

  it('TDD template should contain RED-GREEN-REFACTOR', () => {
    const output = generateTddTemplate();
    expect(output).toContain('RED');
    expect(output).toContain('GREEN');
    expect(output).toContain('REFACTOR');
  });

  it('ADR template should contain decision record structure', () => {
    const output = generateAdrTemplate();
    expect(output).toMatch(/Status|Contexto|Context|Decision|Decisão/);
  });

  it('Threat Model template should contain STRIDE', () => {
    const output = generateThreatModelTemplate();
    expect(output).toContain('STRIDE');
    expect(output).toContain('poofing'); // **S**poofing contains "poofing"
    expect(output).toContain('ampering'); // **T**ampering
  });
});

describe('Stack-Specific Templates', () => {
  it('should generate NestJS rules for NestJS stack', () => {
    const ctx = makeCtx({ frameworks: ['NestJS'] });
    const output = generateStackRules(ctx);

    expect(output).not.toBeNull();
    expect(output).toContain('NestJS');
    expect(output).toContain('@Module');
    expect(output).toContain('@Controller');
    expect(output).toContain('@Injectable');
  });

  it('should generate Angular rules for Angular stack', () => {
    const ctx = makeCtx({ frameworks: ['Angular'], hasFrontend: true });
    const output = generateStackRules(ctx);

    expect(output).not.toBeNull();
    expect(output).toContain('Angular');
    expect(output).toContain('OnPush');
  });

  it('should generate Flutter rules for Flutter stack', () => {
    const ctx = makeCtx({
      primary: 'Dart',
      languages: ['Dart'],
      frameworks: ['Flutter'],
      hasMobile: true,
    });
    const output = generateStackRules(ctx);

    expect(output).not.toBeNull();
    expect(output).toContain('Flutter');
    expect(output).toContain('BLoC');
  });

  it('should generate Python rules for Django stack', () => {
    const ctx = makeCtx({
      primary: 'Python',
      languages: ['Python'],
      frameworks: ['Django'],
    });
    const output = generateStackRules(ctx);

    expect(output).not.toBeNull();
    expect(output).toContain('Django');
  });

  it('should generate Next.js rules for Next.js stack', () => {
    const ctx = makeCtx({ frameworks: ['Next.js'], hasFrontend: true });
    const output = generateStackRules(ctx);

    expect(output).not.toBeNull();
    expect(output).toContain('Next.js');
    expect(output).toContain('Server Component');
  });

  it('should generate Spring rules for Spring stack', () => {
    const ctx = makeCtx({
      primary: 'Java/Kotlin',
      languages: ['Java/Kotlin'],
      frameworks: ['Spring'],
    });
    const output = generateStackRules(ctx);

    expect(output).not.toBeNull();
    expect(output).toContain('Spring');
  });

  it('should generate Express rules for Express stack', () => {
    const ctx = makeCtx({ frameworks: ['Express'] });
    const output = generateStackRules(ctx);

    expect(output).not.toBeNull();
    expect(output).toContain('Express');
  });

  it('should return null for stacks without specific rules', () => {
    const ctx = makeCtx({ frameworks: [] });
    const output = generateStackRules(ctx);

    expect(output).toBeNull();
  });

  describe('getStackRuleFileName', () => {
    it('should return 03-nestjs for NestJS', () => {
      const ctx = makeCtx({ frameworks: ['NestJS'] });
      expect(getStackRuleFileName(ctx)).toBe('03-nestjs');
    });

    it('should return 03-angular for Angular', () => {
      const ctx = makeCtx({ frameworks: ['Angular'] });
      expect(getStackRuleFileName(ctx)).toBe('03-angular');
    });

    it('should return 03-flutter for Flutter', () => {
      const ctx = makeCtx({ frameworks: ['Flutter'] });
      expect(getStackRuleFileName(ctx)).toBe('03-flutter');
    });

    it('should return null for no framework', () => {
      const ctx = makeCtx({ frameworks: [] });
      expect(getStackRuleFileName(ctx)).toBeNull();
    });
  });
});

describe('Template Quality (Enterprise-Grade)', () => {
  const ctx = makeCtx();

  it('core templates should be substantial (not skeleton)', () => {
    const templates = [
      { name: 'INDEX.md', content: generateIndexMd(ctx) },
      { name: 'ORCHESTRATOR', content: generateOrchestrator(ctx) },
      { name: 'PREFLIGHT', content: generatePreflight(ctx) },
      { name: 'QUALITY-GATES', content: generateQualityGates(ctx) },
      { name: '00-general', content: generateGeneralRules(ctx) },
      { name: '01-architecture', content: generateArchitectureRules(ctx) },
      { name: '02-security', content: generateSecurityRules(ctx) },
      { name: 'new-feature', content: generateNewFeatureWorkflow(ctx) },
    ];

    for (const t of templates) {
      // Enterprise-Grade templates should be > 1500 chars minimum
      expect(t.content.length).toBeGreaterThan(1500);
    }
  });

  it('all templates should contain Architect v3.1 signature', () => {
    const templates = [
      generateOrchestrator(ctx),
      generatePreflight(ctx),
      generateQualityGates(ctx),
      generateGeneralRules(ctx),
      generateArchitectureRules(ctx),
      generateSecurityRules(ctx),
      generateBackendAgent(ctx),
      generateSecurityAgent(ctx),
      generateQAAgent(ctx),
    ];

    for (const content of templates) {
      expect(content).toContain('Architect v3.1');
    }
  });

  it('all agent templates should contain agent_card or antigravity frontmatter', () => {
    const agentTemplates = [
      generateOrchestrator(ctx),
      generateBackendAgent(ctx),
      generateSecurityAgent(ctx),
      generateQAAgent(ctx),
      generateTechDebtAgent(ctx),
    ];

    for (const content of agentTemplates) {
      expect(content).toMatch(/antigravity:|agent_card:/);
    }
  });
});
