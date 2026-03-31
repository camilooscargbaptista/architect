import { getEnriched, isEnriched, depthScale, depthAtLeast, crossRef, domainBadge, complianceBadges, depthIndicator, modulesSummaryTable, integrationsSummary, frameworkBadge, projectStructureBadge, toolchainCommands, frameworkModuleStructure, frameworkSecurityChecklist } from '../src/core/agent-generator/templates/template-helpers.js';
import { TemplateContext, EnrichedTemplateContext } from '../src/core/agent-generator/types/template.js';
import { StackInfo, FrameworkInfo, DetectedToolchain } from '../src/core/agent-generator/types/stack.js';
import { DomainInsights, ModuleDetail, DetectedEndpoint } from '../src/core/agent-generator/types/domain.js';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { RefactoringPlan } from '@girardelli/architect-core/src/core/types/rules.js';

// ───────────────────────────────────────────────────────────────
// MOCK BUILDERS
// ───────────────────────────────────────────────────────────────

/**
 * Build a minimal AnalysisReport for testing.
 */
function makeReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      path: '/test-project',
      name: 'test-project',
      frameworks: ['NestJS'],
      totalFiles: 100,
      totalLines: 10000,
      primaryLanguages: ['TypeScript'],
    },
    score: {
      overall: 75,
      components: [],
      breakdown: { modularity: 80, coupling: 70, cohesion: 75, layering: 80 },
    },
    antiPatterns: [],
    layers: [],
    dependencyGraph: { nodes: [], edges: [] },
    suggestions: [],
    diagram: { mermaid: '', type: 'layer' },
    ...overrides,
  };
}

/**
 * Build a minimal RefactoringPlan for testing.
 */
function makePlan(overrides: Partial<RefactoringPlan> = {}): RefactoringPlan {
  return {
    timestamp: new Date().toISOString(),
    projectPath: '/test-project',
    currentScore: { overall: 75, components: [], breakdown: { modularity: 80, coupling: 70, cohesion: 75, layering: 80 } },
    estimatedScoreAfter: { overall: 85, breakdown: { modularity: 85, coupling: 80, cohesion: 85, layering: 85 } },
    steps: [],
    totalOperations: 0,
    tier1Steps: 0,
    tier2Steps: 0,
    ...overrides,
  };
}

/**
 * Build a minimal StackInfo for testing.
 */
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

/**
 * Build a basic TemplateContext (non-enriched).
 */
function makeContext(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return {
    report: makeReport(),
    plan: makePlan(),
    stack: makeStack(),
    projectName: 'test-project',
    stackLabel: 'NestJS + TypeScript',
    config: {
      coverageMinimum: 80,
      scoreThreshold: 70,
      language: 'pt-BR',
      goldenRules: [],
      blockers: [],
    },
    ...overrides,
  };
}

/**
 * Build an EnrichedTemplateContext with all enrichment fields.
 */
function makeEnrichedContext(
  overrides: Partial<EnrichedTemplateContext> = {},
): EnrichedTemplateContext {
  const domain: DomainInsights = {
    domain: 'fintech',
    subDomain: 'payment-processing',
    description: 'Payment processing platform',
    businessEntities: [
      {
        name: 'User',
        source: 'src/entities/user.entity.ts',
        fields: ['id', 'email', 'name'],
        relationships: ['accounts', 'transactions'],
        layer: 'entity',
      },
      {
        name: 'Transaction',
        source: 'src/entities/transaction.entity.ts',
        fields: ['id', 'amount', 'userId'],
        relationships: ['user', 'account'],
        layer: 'entity',
      },
    ],
    compliance: [
      {
        name: 'PCI-DSS',
        reason: 'Processes payment card data',
        mandatoryChecks: ['encryption', 'access-control', 'audit-logging'],
      },
      {
        name: 'LGPD',
        reason: 'Processes Brazilian personal data',
        mandatoryChecks: ['consent', 'right-to-be-forgotten', 'data-portability'],
      },
    ],
    integrations: [
      { name: 'Stripe', type: 'payment', detectedFrom: 'src/services/payment.ts' },
      { name: 'PostgreSQL', type: 'database', detectedFrom: 'package.json' },
      { name: 'Redis', type: 'storage', detectedFrom: 'src/cache/redis.service.ts' },
    ],
    keywords: ['payment', 'transaction', 'user', 'account'],
    confidence: 0.92,
  };

  const modules: ModuleDetail[] = [
    {
      name: 'Users Module',
      path: 'src/users',
      files: ['user.controller.ts', 'user.service.ts', 'user.entity.ts'],
      fileCount: 3,
      lineCount: 350,
      description: 'User management',
      hasTests: true,
      testFiles: ['user.service.spec.ts'],
      entities: ['User'],
      controllers: ['UserController'],
      services: ['UserService'],
      layer: 'feature',
    },
    {
      name: 'Transactions Module',
      path: 'src/transactions',
      files: ['transaction.controller.ts', 'transaction.service.ts', 'transaction.entity.ts'],
      fileCount: 3,
      lineCount: 420,
      description: 'Transaction processing',
      hasTests: true,
      testFiles: ['transaction.service.spec.ts'],
      entities: ['Transaction'],
      controllers: ['TransactionController'],
      services: ['TransactionService'],
      layer: 'feature',
    },
    {
      name: 'Payment Module',
      path: 'src/payment',
      files: ['payment.service.ts', 'payment.controller.ts'],
      fileCount: 2,
      lineCount: 280,
      description: 'Payment processing',
      hasTests: true,
      testFiles: ['payment.service.spec.ts'],
      entities: [],
      controllers: ['PaymentController'],
      services: ['PaymentService'],
      layer: 'feature',
    },
  ];

  const endpoints: DetectedEndpoint[] = [
    {
      method: 'GET',
      path: '/users',
      file: 'src/users/user.controller.ts',
      handler: 'getUsers',
      hasAuth: true,
      hasValidation: true,
    },
    {
      method: 'POST',
      path: '/transactions',
      file: 'src/transactions/transaction.controller.ts',
      handler: 'createTransaction',
      hasAuth: true,
      hasValidation: true,
    },
  ];

  const detectedFrameworks: FrameworkInfo[] = [
    { name: 'NestJS', version: '10.2.8', category: 'web', confidence: 0.99 },
    { name: 'TypeORM', version: '0.3.17', category: 'orm', confidence: 0.98 },
    { name: 'Jest', version: '29.7.0', category: 'test', confidence: 0.99 },
    { name: 'ESLint', version: '8.50.0', category: 'lint', confidence: 0.95 },
  ];

  const toolchain: DetectedToolchain = {
    buildCmd: 'npm run build',
    testCmd: 'npm test',
    lintCmd: 'npm run lint',
    runCmd: 'npm run start:dev',
    coverageCmd: 'npm run test:cov',
    installCmd: 'npm install',
    migrateCmd: 'npm run migration:run',
    depsFile: 'package.json',
  };

  return {
    ...makeContext(),
    domain,
    modules,
    endpoints,
    untestedModules: [],
    criticalPaths: ['src/payment/payment.service.ts'],
    projectDepth: 'large',
    detectedFrameworks,
    primaryFramework: detectedFrameworks[0],
    toolchain,
    projectStructure: 'modular',
    ...overrides,
  };
}

// ───────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────

describe('template-helpers', () => {
  // ─ 1. getEnriched ─
  describe('getEnriched', () => {
    it('should return enriched context when context is enriched', () => {
      const enriched = makeEnrichedContext();
      const result = getEnriched(enriched);

      expect(result).toBeDefined();
      expect(result.domain).toBeDefined();
      expect(result.domain?.domain).toBe('fintech');
      expect(result.modules).toBeDefined();
      expect(result.modules?.length).toBe(3);
    });

    it('should return empty object when context is not enriched', () => {
      const basic = makeContext();
      const result = getEnriched(basic);

      expect(result).toEqual({});
      expect(result.domain).toBeUndefined();
    });
  });

  // ─ 2. isEnriched ─
  describe('isEnriched', () => {
    it('should return true for enriched context', () => {
      const enriched = makeEnrichedContext();
      expect(isEnriched(enriched)).toBe(true);
    });

    it('should return false for non-enriched context', () => {
      const basic = makeContext();
      expect(isEnriched(basic)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const ctx: TemplateContext = makeEnrichedContext();
      if (isEnriched(ctx)) {
        // Should be able to access domain safely
        expect(ctx.domain.domain).toBe('fintech');
      }
    });
  });

  // ─ 3. depthScale ─
  describe('depthScale', () => {
    it('should return small value for small projects', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'small' });
      const result = depthScale(ctx, {
        small: 5,
        medium: 10,
        large: 20,
        enterprise: 50,
      });
      expect(result).toBe(5);
    });

    it('should return medium value for medium projects', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'medium' });
      const result = depthScale(ctx, {
        small: 5,
        medium: 10,
        large: 20,
        enterprise: 50,
      });
      expect(result).toBe(10);
    });

    it('should return large value for large projects', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'large' });
      const result = depthScale(ctx, {
        small: 5,
        medium: 10,
        large: 20,
        enterprise: 50,
      });
      expect(result).toBe(20);
    });

    it('should return enterprise value for enterprise projects', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'enterprise' });
      const result = depthScale(ctx, {
        small: 5,
        medium: 10,
        large: 20,
        enterprise: 50,
      });
      expect(result).toBe(50);
    });

    it('should default to medium when projectDepth is missing', () => {
      const ctx = makeContext(); // Non-enriched
      const result = depthScale(ctx, {
        small: 5,
        medium: 10,
        large: 20,
        enterprise: 50,
      });
      expect(result).toBe(10);
    });

    it('should work with string values', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'large' });
      const result = depthScale(ctx, {
        small: 'tiny',
        medium: 'regular',
        large: 'huge',
        enterprise: 'massive',
      });
      expect(result).toBe('huge');
    });
  });

  // ─ 4. depthAtLeast ─
  describe('depthAtLeast', () => {
    it('should return true when project depth >= minimum', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'large' });
      expect(depthAtLeast(ctx, 'medium')).toBe(true);
      expect(depthAtLeast(ctx, 'large')).toBe(true);
    });

    it('should return false when project depth < minimum', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'small' });
      expect(depthAtLeast(ctx, 'medium')).toBe(false);
      expect(depthAtLeast(ctx, 'large')).toBe(false);
    });

    it('should work with enterprise depth', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'enterprise' });
      expect(depthAtLeast(ctx, 'small')).toBe(true);
      expect(depthAtLeast(ctx, 'medium')).toBe(true);
      expect(depthAtLeast(ctx, 'large')).toBe(true);
      expect(depthAtLeast(ctx, 'enterprise')).toBe(true);
    });

    it('should default to medium when projectDepth missing', () => {
      const ctx = makeContext(); // Non-enriched
      expect(depthAtLeast(ctx, 'small')).toBe(true);
      expect(depthAtLeast(ctx, 'medium')).toBe(true);
      expect(depthAtLeast(ctx, 'large')).toBe(false);
    });
  });

  // ─ 5. crossRef ─
  describe('crossRef', () => {
    it('should generate cross-reference table for backend agent', () => {
      const ctx = makeContext({
        stack: makeStack({
          hasBackend: true,
          hasFrontend: true,
          hasMobile: true,
          hasDatabase: true,
        }),
      });

      const result = crossRef('backend', ctx);

      expect(result).toContain('🔗 Cross-References');
      expect(result).toContain('Database Engineer');
      expect(result).toContain('Security Auditor');
      expect(result).toContain('QA Test Engineer');
      expect(result).toContain('Tech Debt Controller');
    });

    it('should filter out missing stack components', () => {
      const ctx = makeContext({
        stack: makeStack({
          hasFrontend: false,
          hasMobile: false,
          hasDatabase: false,
        }),
      });

      const result = crossRef('backend', ctx);

      // Should not mention frontend or mobile when missing
      expect(result).not.toContain('Frontend Developer');
      expect(result).not.toContain('Flutter');
    });

    it('should return empty string for unknown agent', () => {
      const ctx = makeContext();
      const result = crossRef('unknown-agent', ctx);
      expect(result).toBe('');
    });

    it('should include cross-references for frontend agent', () => {
      const ctx = makeContext({
        stack: makeStack({ hasBackend: true, hasFrontend: true }),
      });

      const result = crossRef('frontend', ctx);

      expect(result).toContain('Backend Developer');
      expect(result).toContain('QA Test Engineer');
    });

    it('should include cross-references for orchestrator agent', () => {
      const ctx = makeContext({
        stack: makeStack({
          hasBackend: true,
          hasFrontend: true,
          hasMobile: true,
          hasDatabase: true,
        }),
      });

      const result = crossRef('orchestrator', ctx);

      expect(result).toContain('Backend Developer');
      expect(result).toContain('Frontend Developer');
      expect(result).toContain('Flutter UI Developer');
      expect(result).toContain('Database Engineer');
      expect(result).toContain('Security Auditor');
    });
  });

  // ─ 6. domainBadge ─
  describe('domainBadge', () => {
    it('should generate domain badge for enriched context', () => {
      const ctx = makeEnrichedContext();
      const result = domainBadge(ctx);

      expect(result).toContain('📌 **Domínio:**');
      expect(result).toContain('fintech');
      expect(result).toContain('payment-processing');
      expect(result).toContain('**Confiança:** 92%');
    });

    it('should return empty string for non-enriched context', () => {
      const ctx = makeContext();
      const result = domainBadge(ctx);
      expect(result).toBe('');
    });

    it('should format confidence as percentage', () => {
      const ctx = makeEnrichedContext({
        domain: {
          ...makeEnrichedContext().domain,
          confidence: 0.85,
        },
      });

      const result = domainBadge(ctx);
      expect(result).toContain('85%');
    });
  });

  // ─ 7. complianceBadges ─
  describe('complianceBadges', () => {
    it('should generate compliance badges when present', () => {
      const ctx = makeEnrichedContext();
      const result = complianceBadges(ctx);

      expect(result).toContain('⚖️ Compliance Obrigatório');
      expect(result).toContain('PCI-DSS');
      expect(result).toContain('LGPD');
      expect(result).toContain('encryption');
      expect(result).toContain('consent');
    });

    it('should return empty string when no compliance', () => {
      const ctx = makeEnrichedContext({
        domain: {
          ...makeEnrichedContext().domain,
          compliance: [],
        },
      });

      const result = complianceBadges(ctx);
      expect(result).toBe('');
    });

    it('should list all mandatory checks', () => {
      const ctx = makeEnrichedContext();
      const result = complianceBadges(ctx);

      expect(result).toContain('access-control');
      expect(result).toContain('audit-logging');
      expect(result).toContain('right-to-be-forgotten');
    });
  });

  // ─ 8. depthIndicator ─
  describe('depthIndicator', () => {
    it('should return green indicator for small projects', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'small' });
      const result = depthIndicator(ctx);
      expect(result).toBe('🟢 Projeto Pequeno (< 50 arquivos)');
    });

    it('should return yellow indicator for medium projects', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'medium' });
      const result = depthIndicator(ctx);
      expect(result).toBe('🟡 Projeto Médio (50-200 arquivos)');
    });

    it('should return orange indicator for large projects', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'large' });
      const result = depthIndicator(ctx);
      expect(result).toBe('🟠 Projeto Grande (200-500 arquivos)');
    });

    it('should return red indicator for enterprise projects', () => {
      const ctx = makeEnrichedContext({ projectDepth: 'enterprise' });
      const result = depthIndicator(ctx);
      expect(result).toBe('🔴 Enterprise (500+ arquivos)');
    });

    it('should default to medium when projectDepth missing', () => {
      const ctx = makeContext();
      const result = depthIndicator(ctx);
      expect(result).toBe('🟡 Projeto Médio (50-200 arquivos)');
    });
  });

  // ─ 9. modulesSummaryTable ─
  describe('modulesSummaryTable', () => {
    it('should generate markdown table for modules', () => {
      const ctx = makeEnrichedContext();
      const result = modulesSummaryTable(ctx);

      expect(result).toContain('| Módulo | Arquivos | Linhas | Testes | Camada |');
      expect(result).toContain('Users Module');
      expect(result).toContain('Transactions Module');
      expect(result).toContain('✅'); // hasTests = true
    });

    it('should return empty string when no modules', () => {
      const ctx = makeEnrichedContext({ modules: [] });
      const result = modulesSummaryTable(ctx);
      expect(result).toBe('');
    });

    it('should respect depth scaling for max modules', () => {
      const modules = Array.from({ length: 30 }, (_, i) => ({
        name: `Module ${i + 1}`,
        path: `src/module-${i + 1}`,
        files: ['index.ts'],
        fileCount: 1,
        lineCount: 100,
        description: `Module ${i + 1}`,
        hasTests: true,
        testFiles: ['index.spec.ts'],
        entities: [],
        controllers: [],
        services: [],
        layer: 'feature',
      }));

      const smallCtx = makeEnrichedContext({ projectDepth: 'small', modules });
      const smallResult = modulesSummaryTable(smallCtx);
      const smallLines = smallResult.split('\n').length;

      const largeCtx = makeEnrichedContext({ projectDepth: 'large', modules });
      const largeResult = modulesSummaryTable(largeCtx);
      const largeLines = largeResult.split('\n').length;

      expect(smallLines).toBeLessThan(largeLines); // Small project shows fewer modules
    });

    it('should show line count with locale formatting', () => {
      const ctx = makeEnrichedContext();
      const result = modulesSummaryTable(ctx);
      expect(result).toContain('350');
      expect(result).toContain('420');
    });

    it('should show "—" for zero line count', () => {
      const ctx = makeEnrichedContext({
        modules: [
          {
            name: 'Empty Module',
            path: 'src/empty',
            files: [],
            fileCount: 0,
            lineCount: 0,
            description: 'Empty',
            hasTests: false,
            testFiles: [],
            entities: [],
            controllers: [],
            services: [],
            layer: 'feature',
          },
        ],
      });

      const result = modulesSummaryTable(ctx);
      expect(result).toContain('—');
    });
  });

  // ─ 10. integrationsSummary ─
  describe('integrationsSummary', () => {
    it('should generate integrations summary', () => {
      const ctx = makeEnrichedContext();
      const result = integrationsSummary(ctx);

      expect(result).toContain('Integrações Externas Detectadas');
      expect(result).toContain('Stripe');
      expect(result).toContain('payment');
      expect(result).toContain('PostgreSQL');
      expect(result).toContain('Redis');
    });

    it('should return empty string when no integrations', () => {
      const ctx = makeEnrichedContext({
        domain: {
          ...makeEnrichedContext().domain,
          integrations: [],
        },
      });

      const result = integrationsSummary(ctx);
      expect(result).toBe('');
    });

    it('should show detected location for each integration', () => {
      const ctx = makeEnrichedContext();
      const result = integrationsSummary(ctx);

      expect(result).toContain('src/services/payment.ts');
      expect(result).toContain('package.json');
      expect(result).toContain('src/cache/redis.service.ts');
    });
  });

  // ─ 11. frameworkBadge ─
  describe('frameworkBadge', () => {
    it('should generate framework badge with versions', () => {
      const ctx = makeEnrichedContext();
      const result = frameworkBadge(ctx);

      expect(result).toContain('🚀 **Stack Detectada:**');
      expect(result).toContain('NestJS');
      expect(result).toContain('10.2.8');
      expect(result).toContain('TypeORM');
      expect(result).toContain('0.3.17');
    });

    it('should include test frameworks', () => {
      const ctx = makeEnrichedContext();
      const result = frameworkBadge(ctx);

      expect(result).toContain('Testes: Jest');
    });

    it('should include lint frameworks', () => {
      const ctx = makeEnrichedContext();
      const result = frameworkBadge(ctx);

      expect(result).toContain('Lint: ESLint');
    });

    it('should return empty string when no frameworks detected', () => {
      const ctx = makeEnrichedContext({
        detectedFrameworks: [],
        primaryFramework: null,
      });

      const result = frameworkBadge(ctx);
      expect(result).toBe('');
    });

    it('should handle frameworks without versions', () => {
      const ctx = makeEnrichedContext({
        detectedFrameworks: [
          { name: 'NestJS', version: null, category: 'web', confidence: 0.99 },
        ],
        primaryFramework: { name: 'NestJS', version: null, category: 'web', confidence: 0.99 },
      });

      const result = frameworkBadge(ctx);
      expect(result).toContain('NestJS');
    });
  });

  // ─ 12. projectStructureBadge ─
  describe('projectStructureBadge', () => {
    it('should return clean architecture badge', () => {
      const ctx = makeEnrichedContext({ projectStructure: 'clean-architecture' });
      const result = projectStructureBadge(ctx);
      expect(result).toBe('🏛️ Clean Architecture / DDD');
    });

    it('should return MVC badge', () => {
      const ctx = makeEnrichedContext({ projectStructure: 'mvc' });
      const result = projectStructureBadge(ctx);
      expect(result).toBe('📐 MVC (Model-View-Controller)');
    });

    it('should return modular badge', () => {
      const ctx = makeEnrichedContext({ projectStructure: 'modular' });
      const result = projectStructureBadge(ctx);
      expect(result).toBe('📦 Modular (Feature-based)');
    });

    it('should return flat badge', () => {
      const ctx = makeEnrichedContext({ projectStructure: 'flat' });
      const result = projectStructureBadge(ctx);
      expect(result).toBe('📄 Flat Structure');
    });

    it('should return monorepo badge', () => {
      const ctx = makeEnrichedContext({ projectStructure: 'monorepo' });
      const result = projectStructureBadge(ctx);
      expect(result).toBe('🏗️ Monorepo');
    });

    it('should return unknown badge', () => {
      const ctx = makeEnrichedContext({ projectStructure: 'unknown' });
      const result = projectStructureBadge(ctx);
      expect(result).toBe('❓ Estrutura não identificada');
    });
  });

  // ─ 13. toolchainCommands ─
  describe('toolchainCommands', () => {
    it('should generate toolchain commands block', () => {
      const ctx = makeEnrichedContext();
      const result = toolchainCommands(ctx);

      expect(result).toContain('🔧 Toolchain Detectado');
      expect(result).toContain('```bash');
      expect(result).toContain('npm run build');
      expect(result).toContain('npm test');
      expect(result).toContain('npm run lint');
      expect(result).toContain('npm run start:dev');
      expect(result).toContain('npm run test:cov');
    });

    it('should include migration command when present', () => {
      const ctx = makeEnrichedContext();
      const result = toolchainCommands(ctx);

      expect(result).toContain('npm run migration:run');
    });

    it('should show deps file', () => {
      const ctx = makeEnrichedContext();
      const result = toolchainCommands(ctx);

      expect(result).toContain('package.json');
    });

    it('should return empty string when no toolchain', () => {
      const ctx = makeEnrichedContext({
        toolchain: undefined as any,
      });

      const result = toolchainCommands(ctx);
      expect(result).toBe('');
    });

    it('should omit migration section when migrateCmd is null', () => {
      const ctx = makeEnrichedContext({
        toolchain: {
          buildCmd: 'npm run build',
          testCmd: 'npm test',
          lintCmd: 'npm run lint',
          runCmd: 'npm run start:dev',
          coverageCmd: 'npm run test:cov',
          installCmd: 'npm install',
          migrateCmd: null,
          depsFile: 'package.json',
        },
      });

      const result = toolchainCommands(ctx);
      expect(result).not.toContain('# Migrations');
    });
  });

  // ─ 14. frameworkModuleStructure ─
  describe('frameworkModuleStructure', () => {
    it('should return FastAPI structure for FastAPI framework', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Python', frameworks: ['FastAPI'] }),
        primaryFramework: { name: 'FastAPI', version: '0.104.1', category: 'web', confidence: 0.99 },
        projectStructure: 'modular',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('app/');
      expect(result).toContain('main.py');
      expect(result).toContain('api/');
      expect(result).toContain('routes/');
      expect(result).toContain('dependencies.py');
      expect(result).toContain('core/');
      expect(result).toContain('config.py');
      expect(result).toContain('services/');
    });

    it('should return Django structure for Django framework', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Python', frameworks: ['Django'] }),
        primaryFramework: { name: 'Django', version: '4.2', category: 'web', confidence: 0.99 },
        projectStructure: 'modular',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('manage.py');
      expect(result).toContain('config/');
      expect(result).toContain('settings/');
      expect(result).toContain('apps/');
      expect(result).toContain('models.py');
      expect(result).toContain('views.py');
      expect(result).toContain('serializers.py');
    });

    it('should return NestJS structure for NestJS framework', () => {
      const ctx = makeEnrichedContext({
        primaryFramework: { name: 'NestJS', version: '10.2.8', category: 'web', confidence: 0.99 },
        projectStructure: 'modular',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('src/');
      expect(result).toContain('main.ts');
      expect(result).toContain('modules/');
      expect(result).toContain('[name].module.ts');
      expect(result).toContain('[name].controller.ts');
      expect(result).toContain('[name].service.ts');
      expect(result).toContain('dto/');
    });

    it('should return Express structure for Express framework', () => {
      const ctx = makeEnrichedContext({
        primaryFramework: { name: 'Express', version: '4.18.2', category: 'web', confidence: 0.99 },
        projectStructure: 'modular',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('src/');
      expect(result).toContain('routes/');
      expect(result).toContain('controllers/');
      expect(result).toContain('services/');
      expect(result).toContain('models/');
      expect(result).toContain('middleware/');
    });

    it('should return Spring Boot structure for Spring Boot framework', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Java', frameworks: ['Spring Boot'] }),
        primaryFramework: { name: 'Spring Boot', version: '3.1.5', category: 'web', confidence: 0.99 },
        projectStructure: 'modular',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('src/main/java');
      expect(result).toContain('Application.java');
      expect(result).toContain('controller/');
      expect(result).toContain('service/');
      expect(result).toContain('repository/');
      expect(result).toContain('model/');
      expect(result).toContain('@SpringBootApplication');
    });

    it('should return Laravel structure for Laravel framework', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'PHP', frameworks: ['Laravel'] }),
        primaryFramework: { name: 'Laravel', version: '10.0', category: 'web', confidence: 0.99 },
        projectStructure: 'modular',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('app/');
      expect(result).toContain('Http/');
      expect(result).toContain('Controllers/');
      expect(result).toContain('Models/');
      expect(result).toContain('database/');
      expect(result).toContain('migrations/');
    });

    it('should return Ruby on Rails structure for Rails framework', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Ruby', frameworks: ['Ruby on Rails'] }),
        primaryFramework: { name: 'Ruby on Rails', version: '7.0', category: 'web', confidence: 0.99 },
        projectStructure: 'modular',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('app/');
      expect(result).toContain('controllers/');
      expect(result).toContain('models/');
      expect(result).toContain('views/');
      expect(result).toContain('config/');
      expect(result).toContain('routes.rb');
    });

    it('should return Go framework structure for Gin', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Go', frameworks: ['Gin'] }),
        primaryFramework: { name: 'Gin', version: '1.9.1', category: 'web', confidence: 0.99 },
        projectStructure: 'modular',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('cmd/');
      expect(result).toContain('internal/');
      expect(result).toContain('handler/');
      expect(result).toContain('service/');
      expect(result).toContain('go.mod');
    });

    it('should return clean architecture Python structure', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Python', frameworks: ['FastAPI'] }),
        primaryFramework: { name: 'FastAPI', version: '0.104.1', category: 'web', confidence: 0.99 },
        projectStructure: 'clean-architecture',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('src/[projeto]/');
      expect(result).toContain('domain/');
      expect(result).toContain('entities/');
      expect(result).toContain('application/');
      expect(result).toContain('infrastructure/');
      expect(result).toContain('presentation/');
    });

    it('should return generic fallback structure', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'UnknownLang', frameworks: [] }),
        primaryFramework: null,
        projectStructure: 'unknown',
      });

      const result = frameworkModuleStructure(ctx);

      expect(result).toContain('src/');
      expect(result).toContain('controllers/');
      expect(result).toContain('services/');
      expect(result).toContain('models/');
    });
  });

  // ─ 15. frameworkSecurityChecklist ─
  describe('frameworkSecurityChecklist', () => {
    it('should return FastAPI security checklist', () => {
      const ctx = makeEnrichedContext({
        primaryFramework: { name: 'FastAPI', version: '0.104.1', category: 'web', confidence: 0.99 },
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — FastAPI');
      expect(result).toContain('Pydantic models');
      expect(result).toContain('OAuth2PasswordBearer');
      expect(result).toContain('CORS');
      expect(result).toContain('Rate limiting');
      expect(result).toContain('passlib');
      expect(result).toContain('JWT tokens');
    });

    it('should return Django security checklist', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Python', frameworks: ['Django'] }),
        primaryFramework: { name: 'Django', version: '4.2', category: 'web', confidence: 0.99 },
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — Django');
      expect(result).toContain('CSRF protection');
      expect(result).toContain('XSS protection');
      expect(result).toContain('SQL Injection');
      expect(result).toContain('SECURE_SSL_REDIRECT');
      expect(result).toContain('DEBUG = False');
    });

    it('should return NestJS security checklist', () => {
      const ctx = makeEnrichedContext({
        primaryFramework: { name: 'NestJS', version: '10.2.8', category: 'web', confidence: 0.99 },
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — NestJS');
      expect(result).toContain('Helmet');
      expect(result).toContain('CORS');
      expect(result).toContain('Rate limiting');
      expect(result).toContain('class-validator');
      expect(result).toContain('Guards');
      expect(result).toContain('JWT');
      expect(result).toContain('npm audit');
    });

    it('should return Express security checklist', () => {
      const ctx = makeEnrichedContext({
        primaryFramework: { name: 'Express', version: '4.18.2', category: 'web', confidence: 0.99 },
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — Express');
      expect(result).toContain('Helmet.js');
      expect(result).toContain('CORS');
      expect(result).toContain('Rate limiting');
      expect(result).toContain('Input validation');
      expect(result).toContain('JWT');
    });

    it('should return Spring Boot security checklist', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Java', frameworks: ['Spring Boot'] }),
        primaryFramework: { name: 'Spring Boot', version: '3.1.5', category: 'web', confidence: 0.99 },
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — Spring Boot');
      expect(result).toContain('Spring Security');
      expect(result).toContain('CSRF');
      expect(result).toContain('CORS');
      expect(result).toContain('BCrypt');
    });

    it('should return Laravel security checklist', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'PHP', frameworks: ['Laravel'] }),
        primaryFramework: { name: 'Laravel', version: '10.0', category: 'web', confidence: 0.99 },
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — Laravel');
      expect(result).toContain('CSRF token');
      expect(result).toContain('Eloquent');
      expect(result).toContain('Form Requests');
      expect(result).toContain('Sanctum/Passport');
    });

    it('should return Python fallback security checklist', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Python', frameworks: [] }),
        primaryFramework: null,
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — Python');
      expect(result).toContain('pydantic');
      expect(result).toContain('Queries parametrizadas');
      expect(result).toContain('pip-audit');
    });

    it('should return Go fallback security checklist', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'Go', frameworks: [] }),
        primaryFramework: null,
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — Go');
      expect(result).toContain('validator');
      expect(result).toContain('Prepared statements');
      expect(result).toContain('govulncheck');
    });

    it('should return generic fallback when no framework or language match', () => {
      const ctx = makeEnrichedContext({
        stack: makeStack({ primary: 'UnknownLang', frameworks: [] }),
        primaryFramework: null,
      });

      const result = frameworkSecurityChecklist(ctx);

      expect(result).toContain('Checklist Segurança — UnknownLang');
      expect(result).toContain('Inputs sanitizados');
      expect(result).toContain('CSRF tokens');
      expect(result).toContain('HTTPS');
    });
  });
});
