import { ContextEnricher } from '../src/core/agent-generator/context-enricher.js';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { RefactoringPlan } from '@girardelli/architect-core/src/core/types/rules.js';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Test Data Factories ──

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
      nodes: ['src/app.module.ts', 'src/app.controller.ts', 'src/app.service.ts', 'src/entity/user.entity.ts'],
      edges: [
        { from: 'src/app.controller.ts', to: 'src/app.service.ts', type: 'import', weight: 1 },
        { from: 'src/app.service.ts', to: 'src/entity/user.entity.ts', type: 'import', weight: 1 },
      ],
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
        description: 'Split monolith service',
        rationale: 'Reduce coupling',
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

// ── Test Suite ──

describe('ContextEnricher', () => {
  const enricher = new ContextEnricher();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(process.cwd(), '__test_context_'));
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('enrich()', () => {
    it('should return a valid EnrichedTemplateContext', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result).toBeDefined();
      expect(result.report).toBe(report);
      expect(result.plan).toBe(plan);
      expect(result.projectName).toBe('test-project');
      expect(result.modules).toBeDefined();
      expect(result.endpoints).toBeDefined();
      expect(result.untestedModules).toBeDefined();
      expect(result.criticalPaths).toBeDefined();
      expect(result.projectDepth).toBeDefined();
    });

    it('should detect modules from dependency graph nodes', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.controller.ts',
            'src/modules/users/users.service.ts',
            'src/modules/users/user.entity.ts',
            'src/modules/auth/auth.controller.ts',
            'src/modules/auth/auth.service.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result.modules.length).toBeGreaterThan(0);
      const moduleNames = result.modules.map(m => m.name);
      expect(moduleNames).toContain('users');
      expect(moduleNames).toContain('auth');
    });

    it('should extract modules sorted by file count descending', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.controller.ts',
            'src/modules/users/users.service.ts',
            'src/modules/users/user.entity.ts',
            'src/modules/auth/auth.controller.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      // Users has 3 files, auth has 1 file → users should come first
      expect(result.modules[0].name).toBe('users');
      expect(result.modules[0].fileCount).toBe(3);
    });

    it('should generate smart descriptions for known patterns', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/extractors/pdf.extractor.ts',
            'src/modules/extractors/image.extractor.ts',
            'src/modules/ocr/ocr.service.ts',
            'src/modules/guards/auth.guard.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const extractorsModule = result.modules.find(m => m.name === 'extractors');
      expect(extractorsModule).toBeDefined();
      expect(extractorsModule!.description).toContain('Extração');

      const ocrModule = result.modules.find(m => m.name === 'ocr');
      expect(ocrModule).toBeDefined();
      expect(ocrModule!.description).toContain('OCR');

      const guardsModule = result.modules.find(m => m.name === 'guards');
      expect(guardsModule).toBeDefined();
      expect(guardsModule!.description).toContain('Validação');
    });

    it('should count lines for real files', () => {
      // Create a temp file with 10 lines
      const subdir = join(tempDir, 'src', 'modules', 'test');
      mkdirSync(subdir, { recursive: true });
      const filePath = join(subdir, 'test.ts');
      const content = Array(10).fill('console.log("test");').join('\n');
      writeFileSync(filePath, content);

      const report = makeReport({
        dependencyGraph: {
          nodes: ['src/modules/test/test.ts'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const testModule = result.modules.find(m => m.name === 'test');
      expect(testModule).toBeDefined();
      expect(testModule!.lineCount).toBeGreaterThan(0);
    });

    it('should detect test files in modules', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.service.ts',
            'src/modules/users/users.service.test.ts',
            'src/modules/users/__tests__/users.spec.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const usersModule = result.modules.find(m => m.name === 'users');
      expect(usersModule).toBeDefined();
      expect(usersModule!.hasTests).toBe(true);
      expect(usersModule!.testFiles.length).toBe(2);
    });

    it('should extract endpoints from route/controller files', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.controller.ts',
            'src/modules/users/users.service.ts',
            'src/auth/auth.controller.ts',
            'src/health/health.controller.ts',
          ],
          edges: [
            { from: 'src/modules/users/users.controller.ts', to: 'src/modules/users/users.service.ts', type: 'import', weight: 1 },
            { from: 'src/auth/auth.controller.ts', to: 'src/dependencies/auth.guard.ts', type: 'import', weight: 1 },
          ],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result.endpoints.length).toBeGreaterThan(0);
      // Should detect users endpoints
      const userEndpoints = result.endpoints.filter(e => e.path.includes('users'));
      expect(userEndpoints.length).toBeGreaterThan(0);
    });

    it('should detect endpoints with authentication', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/auth/auth.controller.ts',
            'src/dependencies/auth.guard.ts',
          ],
          edges: [
            { from: 'src/auth/auth.controller.ts', to: 'src/dependencies/auth.guard.ts', type: 'import', weight: 1 },
          ],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const authEndpoints = result.endpoints.filter(e => e.path.includes('auth'));
      expect(authEndpoints.length).toBeGreaterThan(0);
      // Auth endpoints should be marked as no auth (login/register are public)
      const loginEndpoint = authEndpoints.find(e => e.path === '/auth/login');
      expect(loginEndpoint).toBeDefined();
      expect(loginEndpoint!.hasAuth).toBe(false);
    });

    it('should detect untested modules', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.service.ts',
            'src/modules/users/users.controller.ts',
            'src/modules/notested/service.ts',
            'src/modules/notested/handler.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result.untestedModules).toContain('notested');
    });

    it('should identify critical paths (files with high coupling)', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/app.module.ts',
            'src/app.controller.ts',
            'src/app.service.ts',
            'src/users/user.service.ts',
            'src/auth/auth.service.ts',
          ],
          edges: [
            { from: 'src/app.module.ts', to: 'src/app.controller.ts', type: 'import', weight: 1 },
            { from: 'src/app.module.ts', to: 'src/app.service.ts', type: 'import', weight: 1 },
            { from: 'src/app.module.ts', to: 'src/users/user.service.ts', type: 'import', weight: 1 },
            { from: 'src/app.module.ts', to: 'src/auth/auth.service.ts', type: 'import', weight: 1 },
            { from: 'src/app.controller.ts', to: 'src/app.service.ts', type: 'import', weight: 1 },
          ],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result.criticalPaths.length).toBeGreaterThan(0);
      // app.module.ts should be in critical paths (4 edges)
      expect(result.criticalPaths).toContain('src/app.module.ts');
    });

    it('should classify project depth as small', () => {
      const report = makeReport({
        projectInfo: {
          path: '/test',
          name: 'small-project',
          frameworks: ['NestJS'],
          totalFiles: 10,
          totalLines: 1000,
          primaryLanguages: ['TypeScript'],
        },
        dependencyGraph: {
          nodes: [],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result.projectDepth).toBe('small');
    });

    it('should classify project depth as medium', () => {
      const report = makeReport({
        projectInfo: {
          path: '/test',
          name: 'medium-project',
          frameworks: ['NestJS'],
          totalFiles: 150,
          totalLines: 30000,
          primaryLanguages: ['TypeScript'],
        },
        dependencyGraph: {
          nodes: [],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result.projectDepth).toBe('medium');
    });

    it('should classify project depth as large', () => {
      const report = makeReport({
        projectInfo: {
          path: '/test',
          name: 'large-project',
          frameworks: ['NestJS'],
          totalFiles: 300,
          totalLines: 70000,
          primaryLanguages: ['TypeScript'],
        },
        dependencyGraph: {
          nodes: [],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result.projectDepth).toBe('large');
    });

    it('should classify project depth as enterprise', () => {
      const report = makeReport({
        projectInfo: {
          path: '/test',
          name: 'enterprise-project',
          frameworks: ['NestJS'],
          totalFiles: 1000,
          totalLines: 150000,
          primaryLanguages: ['TypeScript'],
        },
        dependencyGraph: {
          nodes: [],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      expect(result.projectDepth).toBe('enterprise');
    });
  });

  describe('Module inference strategies', () => {
    it('should infer module name from explicit module markers', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.service.ts',
            'src/modules/auth/auth.service.ts',
            'src/features/notifications/notifier.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const moduleNames = result.modules.map(m => m.name);
      expect(moduleNames).toContain('users');
      expect(moduleNames).toContain('auth');
      expect(moduleNames).toContain('notifications');
    });

    it('should infer module name from Django app pattern', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'apps/users/views.py',
            'apps/users/models.py',
            'apps/posts/views.py',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'Python',
        languages: ['Python'],
        frameworks: ['Django'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'pytest',
        packageManager: 'pip',
      }, tempDir);

      const moduleNames = result.modules.map(m => m.name);
      expect(moduleNames).toContain('users');
      expect(moduleNames).toContain('posts');
    });

    it('should infer module name from clean architecture layers', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/domain/entities/user.entity.ts',
            'src/application/services/user.service.ts',
            'src/infrastructure/persistence/user.repository.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      // Should infer modules related to user entity
      expect(result.modules.length).toBeGreaterThan(0);
    });

    it('should handle Java package structure', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/main/java/com/example/users/User.java',
            'src/main/java/com/example/users/UserService.java',
            'src/main/java/com/example/auth/AuthService.java',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'Java',
        languages: ['Java'],
        frameworks: ['Spring Boot'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'JUnit',
        packageManager: 'maven',
      }, tempDir);

      const moduleNames = result.modules.map(m => m.name);
      expect(moduleNames.length).toBeGreaterThan(0);
    });
  });

  describe('Entity and controller detection', () => {
    it('should detect entity files', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/entities/user.entity.ts',
            'src/modules/users/models/user.model.ts',
            'src/modules/users/user.service.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const usersModule = result.modules.find(m => m.name === 'users');
      expect(usersModule).toBeDefined();
      expect(usersModule!.entities.length).toBeGreaterThan(0);
      expect(usersModule!.entities.some(e => e.includes('User'))).toBe(true);
    });

    it('should detect controller files', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.controller.ts',
            'src/modules/auth/auth.controller.ts',
            'src/modules/users/users.service.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const usersModule = result.modules.find(m => m.name === 'users');
      expect(usersModule).toBeDefined();
      expect(usersModule!.controllers.length).toBeGreaterThan(0);
    });

    it('should detect service files', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.service.ts',
            'src/modules/auth/auth.service.ts',
            'src/modules/users/users.controller.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const usersModule = result.modules.find(m => m.name === 'users');
      expect(usersModule).toBeDefined();
      expect(usersModule!.services.length).toBeGreaterThan(0);
    });
  });

  describe('Smart descriptions for patterns', () => {
    it('should generate description for routes/controllers', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: ['src/modules/routes/app.routes.ts'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const routesModule = result.modules.find(m => m.name === 'routes');
      expect(routesModule).toBeDefined();
      expect(routesModule!.description).toContain('rotas');
    });

    it('should generate description for services', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: ['src/modules/services/payment.service.ts'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const servicesModule = result.modules.find(m => m.name === 'services');
      expect(servicesModule).toBeDefined();
      expect(servicesModule!.description).toContain('Serviços');
    });

    it('should generate description for auth modules', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: ['src/modules/auth/auth.service.ts'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const authModule = result.modules.find(m => m.name === 'auth');
      expect(authModule).toBeDefined();
      expect(authModule!.description.toLowerCase()).toContain('autenticação');
    });

    it('should include composition info in descriptions', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: [
            'src/modules/users/users.controller.ts',
            'src/modules/users/users.service.ts',
            'src/modules/users/entities/user.entity.ts',
          ],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const usersModule = result.modules.find(m => m.name === 'users');
      expect(usersModule).toBeDefined();
      // Should include composition info (endpoints, services, entities)
      expect(usersModule!.description).toMatch(/endpoint|service|entit/i);
    });
  });

  describe('Line counting edge cases', () => {
    it('should handle missing files gracefully', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: ['src/nonexistent/file.ts'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      // Should not crash, modules should exist
      expect(result.modules).toBeDefined();
    });

    it('should handle empty files', () => {
      const subdir = join(tempDir, 'src', 'modules', 'empty');
      mkdirSync(subdir, { recursive: true });
      const filePath = join(subdir, 'empty.ts');
      writeFileSync(filePath, '');

      const report = makeReport({
        dependencyGraph: {
          nodes: ['src/modules/empty/empty.ts'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const emptyModule = result.modules.find(m => m.name === 'empty');
      expect(emptyModule).toBeDefined();
      expect(emptyModule!.lineCount).toBe(0);
    });

    it('should count lines in files with various line endings', () => {
      const subdir = join(tempDir, 'src', 'modules', 'mixed');
      mkdirSync(subdir, { recursive: true });
      const filePath = join(subdir, 'mixed.ts');
      // 5 lines
      writeFileSync(filePath, 'line1\nline2\nline3\nline4\nline5');

      const report = makeReport({
        dependencyGraph: {
          nodes: ['src/modules/mixed/mixed.ts'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = enricher.enrich(report, plan, {
        primary: 'TypeScript',
        languages: ['TypeScript'],
        frameworks: ['NestJS'],
        hasBackend: true,
        hasFrontend: false,
        hasMobile: false,
        hasDatabase: true,
        testFramework: 'Jest',
        packageManager: 'npm',
      }, tempDir);

      const mixedModule = result.modules.find(m => m.name === 'mixed');
      expect(mixedModule).toBeDefined();
      expect(mixedModule!.lineCount).toBeGreaterThan(0);
    });
  });
});
