import { AgentGenerator } from '../src/agent-generator/index.js';
import { AnalysisReport, RefactoringPlan } from '../src/types.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
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

describe('AgentGenerator', () => {
  const generator = new AgentGenerator();
  const testOutputDir = join(process.cwd(), '__test_agent_output__');

  afterEach(() => {
    // Clean up generated test directories
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('suggest()', () => {
    it('should return a valid AgentSuggestion', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');

      expect(result).toBeDefined();
      expect(result.stack).toBeDefined();
      expect(result.suggestedAgents).toBeDefined();
      expect(result.suggestedRules).toBeDefined();
      expect(result.suggestedGuards).toBeDefined();
      expect(result.suggestedWorkflows).toBeDefined();
      expect(result.suggestedSkills).toBeDefined();
      expect(result.command).toBeDefined();
    });

    it('should detect TypeScript + NestJS stack', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');

      expect(result.stack.primary).toBe('TypeScript');
      expect(result.stack.frameworks).toContain('NestJS');
      expect(result.stack.hasBackend).toBe(true);
      expect(result.stack.hasDatabase).toBe(true);
    });

    it('should suggest backend agent for backend stack', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');

      const backendAgent = result.suggestedAgents.find(a => a.name.includes('BACKEND'));
      expect(backendAgent).toBeDefined();
      expect(backendAgent!.status).toBe('CREATE');
    });

    it('should suggest database agent when database detected', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');

      const dbAgent = result.suggestedAgents.find(a => a.name.includes('DATABASE'));
      expect(dbAgent).toBeDefined();
    });

    it('should always suggest orchestrator, security, QA, and tech debt agents', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');
      const names = result.suggestedAgents.map(a => a.name);

      expect(names).toContain('AGENT-ORCHESTRATOR');
      expect(names.some(n => n.includes('SECURITY'))).toBe(true);
      expect(names.some(n => n.includes('QA'))).toBe(true);
      expect(names.some(n => n.includes('TECH-DEBT'))).toBe(true);
    });

    it('should suggest 3+ rules including architecture and security', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');
      const ruleNames = result.suggestedRules.map(r => r.name);

      expect(ruleNames).toContain('00-general');
      expect(ruleNames).toContain('01-architecture');
      expect(ruleNames).toContain('02-security');
    });

    it('should suggest stack-specific rule for NestJS', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');
      const ruleNames = result.suggestedRules.map(r => r.name);

      expect(ruleNames.some(n => n.includes('03-nestjs'))).toBe(true);
    });

    it('should suggest 3 guards', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');

      expect(result.suggestedGuards.length).toBe(3);
      const names = result.suggestedGuards.map(g => g.name);
      expect(names).toContain('PREFLIGHT');
      expect(names).toContain('QUALITY-GATES');
      expect(names).toContain('CODE-REVIEW-CHECKLIST');
    });

    it('should suggest 3 workflows', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');

      expect(result.suggestedWorkflows.length).toBe(3);
      const names = result.suggestedWorkflows.map(w => w.name);
      expect(names).toContain('new-feature');
      expect(names).toContain('fix-bug');
      expect(names).toContain('review');
    });

    it('should suggest skills including stack-specific ones', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/test');

      expect(result.suggestedSkills.length).toBeGreaterThan(5);
      const skillNames = result.suggestedSkills.map(s => s.name);
      expect(skillNames).toContain('test-driven-development');
      expect(skillNames).toContain('security-best-practices');
      // TypeScript-specific
      expect(skillNames).toContain('api-design-principles');
    });

    it('should mark hasExistingAgents false for non-existing directory', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.suggest(report, plan, '/non-existing-path');

      expect(result.hasExistingAgents).toBe(false);
    });
  });

  describe('generate() — full generation', () => {
    it('should create .agent/ directory structure', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      expect(result.generated.length).toBeGreaterThan(15);
      expect(result.audit).toHaveLength(0); // No audit for fresh generation

      // Verify directory structure
      expect(existsSync(join(testOutputDir, 'agents'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'rules'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'guards'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'workflows'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'templates'))).toBe(true);
      expect(existsSync(join(testOutputDir, 'skills'))).toBe(true);
    });

    it('should generate core files', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      expect(result.generated).toContain('INDEX.md');
      expect(result.generated).toContain('agents/AGENT-ORCHESTRATOR.md');
      expect(result.generated).toContain('guards/PREFLIGHT.md');
      expect(result.generated).toContain('guards/QUALITY-GATES.md');
      expect(result.generated).toContain('rules/00-general.md');
      expect(result.generated).toContain('rules/01-architecture.md');
      expect(result.generated).toContain('rules/02-security.md');
      expect(result.generated).toContain('workflows/new-feature.md');
      expect(result.generated).toContain('workflows/fix-bug.md');
      expect(result.generated).toContain('workflows/review.md');
    });

    it('should generate stack-specific agents for NestJS', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      expect(result.generated.some(f => f.includes('TYPESCRIPT-BACKEND-DEVELOPER'))).toBe(true);
      expect(result.generated.some(f => f.includes('DATABASE-ENGINEER'))).toBe(true);
    });

    it('should generate stack-specific rules for NestJS', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      expect(result.generated.some(f => f.includes('03-nestjs'))).toBe(true);
    });

    it('should generate domain templates', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      expect(result.generated).toContain('templates/C4.md');
      expect(result.generated).toContain('templates/BDD.md');
      expect(result.generated).toContain('templates/TDD.md');
      expect(result.generated).toContain('templates/ADR.md');
      expect(result.generated).toContain('templates/THREAT-MODEL.md');
    });

    it('should generate frontend agent when frontend detected', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: ['src/app.component.ts', 'src/app.module.ts', 'src/angular.json'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      expect(result.generated.some(f => f.includes('FRONTEND-DEVELOPER'))).toBe(true);
    });

    it('should generate mobile agent when Dart detected', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: ['lib/main.dart', 'lib/app.dart'],
          edges: [],
        },
      });
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      expect(result.generated.some(f => f.includes('FLUTTER-UI-DEVELOPER'))).toBe(true);
    });

    it('should generate 18+ files total for a full NestJS project', () => {
      const report = makeReport();
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      // Core: INDEX + ORCHESTRATOR + PREFLIGHT + QUALITY-GATES + CODE-REVIEW +
      //        00-general + 01-architecture + 02-security + 03-nestjs +
      //        new-feature + fix-bug + review = 12
      // Agents: BACKEND + DATABASE + SECURITY + QA + TECH-DEBT = 5
      // Templates: C4 + BDD + TDD + ADR + THREAT-MODEL = 5
      // Total: 22+
      expect(result.generated.length).toBeGreaterThanOrEqual(18);
    });
  });

  describe('generate() — audit existing', () => {
    it('should audit and generate missing files', () => {
      // Create a partial .agent/ directory
      mkdirSync(join(testOutputDir, 'agents'), { recursive: true });
      mkdirSync(join(testOutputDir, 'rules'), { recursive: true });
      writeFileSync(join(testOutputDir, 'INDEX.md'), '# Existing Index');
      writeFileSync(join(testOutputDir, 'agents/AGENT-ORCHESTRATOR.md'), '# Existing Orchestrator');

      const report = makeReport();
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      // Should have audit findings
      expect(result.audit.length).toBeGreaterThan(0);

      // Should have found some files OK
      const okFindings = result.audit.filter(f => f.type === 'OK');
      expect(okFindings.length).toBeGreaterThanOrEqual(2); // INDEX.md + ORCHESTRATOR

      // Should have found some missing
      const missingFindings = result.audit.filter(f => f.type === 'MISSING');
      expect(missingFindings.length).toBeGreaterThan(0);

      // Should have generated the missing files
      expect(result.generated.length).toBeGreaterThan(0);
    });

    it('should suggest improvement when score is low', () => {
      mkdirSync(join(testOutputDir, 'agents'), { recursive: true });
      mkdirSync(join(testOutputDir, 'guards'), { recursive: true });
      writeFileSync(join(testOutputDir, 'INDEX.md'), '# Index');
      writeFileSync(join(testOutputDir, 'guards/QUALITY-GATES.md'), '# Gates');

      const report = makeReport({
        score: {
          overall: 50,
          components: [],
          breakdown: { modularity: 50, coupling: 45, cohesion: 55, layering: 50 },
        },
      });
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      const improvements = result.audit.filter(f => f.type === 'IMPROVEMENT');
      expect(improvements.length).toBeGreaterThan(0);
    });
  });

  describe('Python stack generation', () => {
    it('should generate Python-specific agents and rules', () => {
      const report = makeReport({
        dependencyGraph: {
          nodes: ['manage.py', 'app/views.py', 'app/models.py', 'app/serializers.py'],
          edges: [
            { from: 'app/views.py', to: 'app/models.py', type: 'import', weight: 1 },
          ],
        },
      });
      const plan = makePlan();

      const result = generator.generate(report, plan, '/test', testOutputDir);

      // Should detect Python + Django
      expect(result.generated.some(f => f.includes('PYTHON-BACKEND-DEVELOPER'))).toBe(true);
      expect(result.generated.some(f => f.includes('03-django'))).toBe(true);
    });
  });
});
