/**
 * Architecture Blueprint Generator
 *
 * Transforms ParsedRequirements into an ArchitectureBlueprint —
 * a complete set of architectural decisions: style, stack, layers,
 * modules, boundaries, and rules.
 *
 * Decision logic:
 * - Architecture style chosen based on # of bounded contexts + integrations
 * - Stack inferred from constraints or defaulted per domain
 * - Layers and boundaries derived from the chosen style
 * - Modules generated from bounded contexts + entities
 *
 * @since v10.0.0 — Phase 4.2
 */

import type {
  ParsedRequirements,
  ArchitectureBlueprint,
  ArchitectureStyle,
  StackDecision,
  LayerDefinition,
  ModuleDefinition,
  ModuleFile,
  CrossCuttingConcern,
  BlueprintRule,
  DependencyBoundary,
} from './types.js';

// ── Style selection ───────────────────────────────────────

interface StyleScore {
  style: ArchitectureStyle;
  score: number;
  rationale: string;
}

// ── Generator ─────────────────────────────────────────────

export class BlueprintGenerator {
  /**
   * Generate a complete architecture blueprint from parsed requirements.
   */
  generate(requirements: ParsedRequirements): ArchitectureBlueprint {
    const style = this.selectStyle(requirements);
    const stack = this.selectStack(requirements);
    const layers = this.defineLayers(style.style, stack);
    const modules = this.defineModules(requirements, layers, stack);
    const crossCutting = this.defineCrossCutting(requirements, stack);
    const rules = this.defineRules(style.style, requirements);
    const boundaries = this.defineBoundaries(layers, modules);

    return {
      projectName: this.toKebabCase(requirements.projectName),
      description: requirements.description,
      style: style.style,
      styleRationale: style.rationale,
      stack,
      layers,
      modules,
      crossCutting,
      rules,
      entities: requirements.entities,
      boundaries,
    };
  }

  // ── Architecture style ──────────────────────────────────

  selectStyle(req: ParsedRequirements): StyleScore {
    const scores: StyleScore[] = [
      {
        style: 'layered-monolith',
        score: this.scoreLayered(req),
        rationale: 'Simple and fast to build. Good for small teams with few bounded contexts.',
      },
      {
        style: 'clean-architecture',
        score: this.scoreClean(req),
        rationale: 'Strong separation of concerns. Business logic independent of frameworks.',
      },
      {
        style: 'hexagonal',
        score: this.scoreHexagonal(req),
        rationale: 'Ports and adapters pattern. Excellent for complex integrations.',
      },
      {
        style: 'modular-monolith',
        score: this.scoreModularMonolith(req),
        rationale: 'Domain-driven modules with clear boundaries. Scales to microservices later.',
      },
      {
        style: 'microservices',
        score: this.scoreMicroservices(req),
        rationale: 'Independent deployment per bounded context. High operational complexity.',
      },
      {
        style: 'event-driven',
        score: this.scoreEventDriven(req),
        rationale: 'Async event processing. Great for workflows and real-time systems.',
      },
    ];

    scores.sort((a, b) => b.score - a.score);
    return scores[0]!;
  }

  private scoreLayered(req: ParsedRequirements): number {
    let score = 50;
    if (req.boundedContexts.length <= 2) score += 20;
    if (req.entities.length <= 5) score += 15;
    if (req.integrations.length <= 2) score += 10;
    if (req.boundedContexts.length > 5) score -= 30;
    return score;
  }

  private scoreClean(req: ParsedRequirements): number {
    let score = 40;
    if (req.boundedContexts.length >= 2 && req.boundedContexts.length <= 5) score += 20;
    if (req.entities.length >= 3) score += 15;
    if (req.nonFunctional.security.length > 0) score += 10;
    if (req.integrations.length >= 2) score += 10;
    return score;
  }

  private scoreHexagonal(req: ParsedRequirements): number {
    let score = 30;
    if (req.integrations.length >= 3) score += 25;
    if (req.integrations.some(i => i.type === 'database') && req.integrations.some(i => i.type === 'queue')) score += 15;
    if (req.nonFunctional.compliance.length > 0) score += 10;
    if (req.integrations.length < 2) score -= 20;
    return score;
  }

  private scoreModularMonolith(req: ParsedRequirements): number {
    let score = 45;
    if (req.boundedContexts.length >= 3 && req.boundedContexts.length <= 8) score += 25;
    if (req.entities.length >= 5) score += 15;
    if (req.domain !== 'general') score += 10;
    if (req.boundedContexts.length < 2) score -= 20;
    return score;
  }

  private scoreMicroservices(req: ParsedRequirements): number {
    let score = 20;
    if (req.boundedContexts.length >= 5) score += 30;
    if (req.nonFunctional.scalability) score += 15;
    if (req.integrations.some(i => i.type === 'queue')) score += 10;
    if (req.boundedContexts.length < 3) score -= 30;
    if (req.entities.length < 5) score -= 15;
    return score;
  }

  private scoreEventDriven(req: ParsedRequirements): number {
    let score = 25;
    if (req.integrations.some(i => i.type === 'queue')) score += 30;
    if (req.integrations.some(i => i.type === 'websocket')) score += 20;
    if (req.workflows.length >= 3) score += 15;
    if (req.nonFunctional.performance) score += 10;
    if (!req.integrations.some(i => i.type === 'queue' || i.type === 'websocket')) score -= 20;
    return score;
  }

  // ── Stack selection ─────────────────────────────────────

  selectStack(req: ParsedRequirements): StackDecision {
    const lang = req.nonFunctional.preferredStack?.toLowerCase() ?? 'typescript';
    const isPython = lang.includes('python');
    const isGo = lang.includes('go');

    const framework = this.detectFramework(req);

    if (isPython) {
      return {
        language: 'python',
        runtime: 'python3',
        framework: framework ?? 'fastapi',
        database: req.nonFunctional.database ?? 'postgresql',
        orm: 'sqlalchemy',
        testFramework: 'pytest',
        buildTool: 'poetry',
        packageManager: 'pip',
        libraries: this.inferLibraries(req, 'python'),
      };
    }

    if (isGo) {
      return {
        language: 'go',
        runtime: 'go1.22',
        framework: framework ?? 'gin',
        database: req.nonFunctional.database ?? 'postgresql',
        orm: 'gorm',
        testFramework: 'testing',
        buildTool: 'go',
        packageManager: 'go modules',
        libraries: this.inferLibraries(req, 'go'),
      };
    }

    // Default: TypeScript
    return {
      language: 'typescript',
      runtime: 'node',
      framework: framework ?? 'express',
      database: req.nonFunctional.database ?? 'postgresql',
      orm: this.inferORM(req),
      testFramework: 'jest',
      buildTool: 'tsc',
      packageManager: 'npm',
      libraries: this.inferLibraries(req, 'typescript'),
    };
  }

  private detectFramework(req: ParsedRequirements): string | undefined {
    for (const c of req.constraints) {
      const match = c.match(/framework:\s*(\w+)/i);
      if (match) return match[1]!.toLowerCase();
    }
    return undefined;
  }

  private inferORM(req: ParsedRequirements): string {
    const db = (req.nonFunctional.database ?? '').toLowerCase();
    if (db.includes('mongo')) return 'mongoose';
    if (db.includes('prisma')) return 'prisma';
    if (db.includes('drizzle')) return 'drizzle';
    return 'prisma'; // default for TS
  }

  private inferLibraries(req: ParsedRequirements, lang: string): Array<{ name: string; purpose: string }> {
    const libs: Array<{ name: string; purpose: string }> = [];

    if (req.nonFunctional.auth) {
      if (lang === 'typescript') {
        if (req.nonFunctional.auth.includes('jwt')) libs.push({ name: 'jsonwebtoken', purpose: 'JWT authentication' });
        if (req.nonFunctional.auth.includes('oauth')) libs.push({ name: 'passport', purpose: 'OAuth authentication' });
      }
    }

    if (req.integrations.some(i => i.type === 'queue')) {
      if (lang === 'typescript') libs.push({ name: 'bullmq', purpose: 'Job queue' });
    }

    if (req.integrations.some(i => i.type === 'websocket')) {
      if (lang === 'typescript') libs.push({ name: 'socket.io', purpose: 'WebSocket server' });
    }

    if (lang === 'typescript') {
      libs.push({ name: 'zod', purpose: 'Runtime schema validation' });
      libs.push({ name: 'dotenv', purpose: 'Environment configuration' });
    }

    return libs;
  }

  // ── Layer definitions ───────────────────────────────────

  defineLayers(style: ArchitectureStyle, _stack: StackDecision): LayerDefinition[] {

    switch (style) {
      case 'clean-architecture':
        return [
          { name: 'domain', directory: 'src/domain', responsibility: 'Business entities and rules', allowedDependencies: [], files: [] },
          { name: 'application', directory: 'src/application', responsibility: 'Use cases and orchestration', allowedDependencies: ['domain'], files: [] },
          { name: 'infrastructure', directory: 'src/infrastructure', responsibility: 'Database, APIs, external services', allowedDependencies: ['domain', 'application'], files: [] },
          { name: 'presentation', directory: 'src/presentation', responsibility: 'HTTP controllers, CLI adapters', allowedDependencies: ['application'], files: [] },
        ];

      case 'hexagonal':
        return [
          { name: 'domain', directory: 'src/domain', responsibility: 'Core business logic', allowedDependencies: [], files: [] },
          { name: 'ports', directory: 'src/ports', responsibility: 'Interface definitions (inbound + outbound)', allowedDependencies: ['domain'], files: [] },
          { name: 'adapters', directory: 'src/adapters', responsibility: 'Implementations of ports', allowedDependencies: ['domain', 'ports'], files: [] },
          { name: 'config', directory: 'src/config', responsibility: 'Wiring and DI configuration', allowedDependencies: ['domain', 'ports', 'adapters'], files: [] },
        ];

      case 'modular-monolith':
        return [
          { name: 'shared', directory: 'src/shared', responsibility: 'Shared kernel (types, utils, events)', allowedDependencies: [], files: [] },
          { name: 'modules', directory: 'src/modules', responsibility: 'Bounded context modules', allowedDependencies: ['shared'], files: [] },
          { name: 'infrastructure', directory: 'src/infrastructure', responsibility: 'Cross-cutting infra', allowedDependencies: ['shared'], files: [] },
          { name: 'api', directory: 'src/api', responsibility: 'HTTP/GraphQL entry points', allowedDependencies: ['shared', 'modules'], files: [] },
        ];

      case 'event-driven':
        return [
          { name: 'domain', directory: 'src/domain', responsibility: 'Events, commands, aggregates', allowedDependencies: [], files: [] },
          { name: 'handlers', directory: 'src/handlers', responsibility: 'Event and command handlers', allowedDependencies: ['domain'], files: [] },
          { name: 'infrastructure', directory: 'src/infrastructure', responsibility: 'Message brokers, persistence', allowedDependencies: ['domain'], files: [] },
          { name: 'api', directory: 'src/api', responsibility: 'Ingress (HTTP, WebSocket)', allowedDependencies: ['domain', 'handlers'], files: [] },
        ];

      case 'microservices':
      case 'layered-monolith':
      default:
        return [
          { name: 'controllers', directory: 'src/controllers', responsibility: 'HTTP request handlers', allowedDependencies: ['services'], files: [] },
          { name: 'services', directory: 'src/services', responsibility: 'Business logic', allowedDependencies: ['repositories', 'types'], files: [] },
          { name: 'repositories', directory: 'src/repositories', responsibility: 'Data access layer', allowedDependencies: ['types'], files: [] },
          { name: 'types', directory: 'src/types', responsibility: 'Type definitions and DTOs', allowedDependencies: [], files: [] },
        ];
    }
  }

  // ── Module definitions ──────────────────────────────────

  defineModules(req: ParsedRequirements, layers: LayerDefinition[], stack: StackDecision): ModuleDefinition[] {
    const modules: ModuleDefinition[] = [];
    const ext = stack.language === 'typescript' ? '.ts' : stack.language === 'python' ? '.py' : '.go';

    for (const ctx of req.boundedContexts) {
      const moduleName = this.toKebabCase(ctx.name);
      const entities = req.entities.filter(e => ctx.entities.includes(e.name));

      for (const layer of layers) {
        const files = this.generateModuleFiles(moduleName, entities, layer, ext, stack);
        if (files.length === 0) continue;

        modules.push({
          name: `${moduleName}-${layer.name}`,
          directory: `${layer.directory}/${moduleName}`,
          boundedContext: ctx.name,
          layer: layer.name,
          description: `${ctx.name} — ${layer.responsibility}`,
          files,
          dependencies: layer.allowedDependencies.map(d => `${moduleName}-${d}`),
        });
      }
    }

    return modules;
  }

  private generateModuleFiles(
    moduleName: string,
    entities: Array<{ name: string }>,
    layer: LayerDefinition,
    ext: string,
    _stack: StackDecision,
  ): ModuleFile[] {
    const files: ModuleFile[] = [];
    const pascal = this.toPascalCase(moduleName);

    switch (layer.name) {
      case 'controllers':
      case 'presentation':
      case 'api':
        files.push({
          path: `${layer.directory}/${moduleName}/${moduleName}.controller${ext}`,
          type: 'controller',
          template: 'controller',
          description: `${pascal} HTTP controller`,
        });
        for (const e of entities) {
          files.push({
            path: `${layer.directory}/${moduleName}/${this.toKebabCase(e.name)}.dto${ext}`,
            type: 'dto',
            template: 'dto',
            description: `${e.name} request/response DTOs`,
          });
        }
        break;

      case 'services':
      case 'application':
      case 'handlers':
        files.push({
          path: `${layer.directory}/${moduleName}/${moduleName}.service${ext}`,
          type: 'service',
          template: 'service',
          description: `${pascal} business logic`,
        });
        break;

      case 'repositories':
      case 'infrastructure':
      case 'adapters':
        files.push({
          path: `${layer.directory}/${moduleName}/${moduleName}.repository${ext}`,
          type: 'repository',
          template: 'repository',
          description: `${pascal} data access`,
        });
        break;

      case 'types':
      case 'domain':
      case 'ports':
        for (const e of entities) {
          files.push({
            path: `${layer.directory}/${moduleName}/${this.toKebabCase(e.name)}.entity${ext}`,
            type: 'entity',
            template: 'entity',
            description: `${e.name} entity definition`,
          });
        }
        files.push({
          path: `${layer.directory}/${moduleName}/${moduleName}.types${ext}`,
          type: 'interface',
          template: 'types',
          description: `${pascal} interfaces`,
        });
        break;

      case 'shared':
      case 'config':
        // Shared modules are generated separately
        break;

      case 'modules':
        // Modular monolith: each module is self-contained
        files.push(
          { path: `${layer.directory}/${moduleName}/${moduleName}.controller${ext}`, type: 'controller', template: 'controller', description: `${pascal} controller` },
          { path: `${layer.directory}/${moduleName}/${moduleName}.service${ext}`, type: 'service', template: 'service', description: `${pascal} service` },
          { path: `${layer.directory}/${moduleName}/${moduleName}.repository${ext}`, type: 'repository', template: 'repository', description: `${pascal} repository` },
        );
        for (const e of entities) {
          files.push({ path: `${layer.directory}/${moduleName}/${this.toKebabCase(e.name)}.entity${ext}`, type: 'entity', template: 'entity', description: `${e.name} entity` });
        }
        break;
    }

    // Index/barrel file
    if (files.length > 0) {
      files.push({
        path: `${layer.directory}/${moduleName}/index${ext}`,
        type: 'index',
        template: 'index',
        description: `${pascal} barrel export`,
      });
    }

    return files;
  }

  // ── Cross-cutting concerns ──────────────────────────────

  defineCrossCutting(req: ParsedRequirements, stack: StackDecision): CrossCuttingConcern[] {
    const concerns: CrossCuttingConcern[] = [];
    const ext = stack.language === 'typescript' ? '.ts' : '.py';

    // Auth middleware
    if (req.nonFunctional.auth) {
      concerns.push({
        name: 'auth',
        type: 'auth',
        directory: 'src/shared/auth',
        files: [
          { path: `src/shared/auth/auth.middleware${ext}`, type: 'middleware', template: 'auth-middleware', description: `${req.nonFunctional.auth} authentication middleware` },
          { path: `src/shared/auth/auth.guard${ext}`, type: 'middleware', template: 'auth-guard', description: 'Route guard' },
        ],
      });
    }

    // Error handling
    concerns.push({
      name: 'error-handling',
      type: 'error-handling',
      directory: 'src/shared/errors',
      files: [
        { path: `src/shared/errors/app-error${ext}`, type: 'handler', template: 'app-error', description: 'Custom error classes' },
        { path: `src/shared/errors/error-handler${ext}`, type: 'middleware', template: 'error-handler', description: 'Global error handler' },
      ],
    });

    // Logging
    concerns.push({
      name: 'logging',
      type: 'logging',
      directory: 'src/shared/logger',
      files: [
        { path: `src/shared/logger/logger${ext}`, type: 'config', template: 'logger', description: 'Structured logger' },
      ],
    });

    // Validation
    concerns.push({
      name: 'validation',
      type: 'validation',
      directory: 'src/shared/validation',
      files: [
        { path: `src/shared/validation/validate${ext}`, type: 'middleware', template: 'validation', description: 'Request validation middleware' },
      ],
    });

    return concerns;
  }

  // ── Architecture rules ──────────────────────────────────

  defineRules(style: ArchitectureStyle, _req: ParsedRequirements): BlueprintRule[] {
    const rules: BlueprintRule[] = [];

    rules.push({
      type: 'quality_gate',
      yaml: `quality_gates:\n  min_overall_score: 65\n  max_critical_anti_patterns: 0\n  max_high_anti_patterns: 3`,
      description: 'Minimum architecture quality standards',
    });

    rules.push({
      type: 'boundary',
      yaml: `boundaries:\n  allow_circular_dependencies: false`,
      description: 'No circular dependencies allowed',
    });

    // Style-specific rules
    if (style === 'clean-architecture' || style === 'hexagonal') {
      rules.push({
        type: 'dependency',
        yaml: `boundaries:\n  banned_imports:\n    - from: "domain/*"\n      to: "infrastructure/*"\n    - from: "domain/*"\n      to: "presentation/*"`,
        description: 'Domain layer must not depend on outer layers',
      });
    }

    if (style === 'modular-monolith') {
      rules.push({
        type: 'boundary',
        yaml: `boundaries:\n  banned_imports:\n    - from: "modules/*/internal/*"\n      to: "modules/*/internal/*"\n      except_same_module: true`,
        description: 'Modules must not access other modules internals',
      });
    }

    return rules;
  }

  // ── Dependency boundaries ───────────────────────────────

  defineBoundaries(layers: LayerDefinition[], _modules: ModuleDefinition[]): DependencyBoundary[] {
    const boundaries: DependencyBoundary[] = [];

    for (const layer of layers) {
      for (const otherLayer of layers) {
        if (layer.name === otherLayer.name) continue;

        const allowed = layer.allowedDependencies.includes(otherLayer.name);
        boundaries.push({
          from: layer.name,
          to: otherLayer.name,
          allowed,
          reason: allowed
            ? `${layer.name} may depend on ${otherLayer.name}`
            : `${layer.name} must NOT depend on ${otherLayer.name}`,
        });
      }
    }

    return boundaries;
  }

  // ── Helpers ─────────────────────────────────────────────

  private toKebabCase(s: string): string {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-zA-Z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  private toPascalCase(s: string): string {
    return s.replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_, c: string) => c.toUpperCase());
  }
}
