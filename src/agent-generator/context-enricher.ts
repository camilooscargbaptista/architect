import { AnalysisReport, RefactoringPlan } from '../types.js';
import {
  StackInfo,
  EnrichedTemplateContext,
  ModuleDetail,
  DetectedEndpoint,
  AgentGeneratorConfig,
  DEFAULT_AGENT_CONFIG,
} from './types.js';
import { DomainInferrer } from './domain-inferrer.js';

/**
 * ContextEnricher — Builds an EnrichedTemplateContext from AnalysisReport.
 *
 * Multi-stack: detects modules and endpoints for Python, TypeScript, Java, PHP,
 * Go, Ruby, Dart — supports NestJS modules, Django apps, FastAPI routers,
 * Spring controllers, Laravel controllers, Flask blueprints, and more.
 *
 * Two detection strategies:
 * 1. Marker-based: looks for known directory markers (modules/, features/, apps/)
 * 2. Clean Architecture: detects layer-based structure (domain/, infrastructure/, presentation/)
 *    and uses the sub-directories as module names
 */
export class ContextEnricher {
  private domainInferrer = new DomainInferrer();

  /**
   * Build a fully enriched context for template generation.
   */
  enrich(
    report: AnalysisReport,
    plan: RefactoringPlan,
    stack: StackInfo,
    projectPath: string,
    config: AgentGeneratorConfig = DEFAULT_AGENT_CONFIG,
  ): EnrichedTemplateContext {
    const modules = this.extractModules(report);
    const endpoints = this.extractEndpoints(report, modules);
    const untestedModules = this.findUntestedModules(modules);
    const criticalPaths = this.findCriticalPaths(report);
    const projectDepth = this.classifyProjectDepth(report);
    const domain = this.domainInferrer.infer(report, projectPath);

    return {
      report,
      plan,
      stack,
      projectName: report.projectInfo.name || 'Project',
      stackLabel: [...stack.languages, ...stack.frameworks].join(' + '),
      config,
      domain,
      modules,
      endpoints,
      untestedModules,
      criticalPaths,
      projectDepth,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODULE EXTRACTION — Multi-stack, multi-architecture
  // ═══════════════════════════════════════════════════════════════════════

  private extractModules(report: AnalysisReport): ModuleDetail[] {
    const modules = new Map<string, ModuleDetail>();
    const nodes = report.dependencyGraph.nodes;

    for (const filePath of nodes) {
      const moduleName = this.inferModuleName(filePath);
      if (!moduleName) continue;

      if (!modules.has(moduleName)) {
        modules.set(moduleName, {
          name: moduleName,
          path: this.inferModulePath(filePath, moduleName),
          files: [],
          fileCount: 0,
          lineCount: 0,
          description: '',
          hasTests: false,
          testFiles: [],
          entities: [],
          controllers: [],
          services: [],
          layer: this.inferFileLayer(filePath),
        });
      }

      const mod = modules.get(moduleName)!;
      mod.files.push(filePath);
      mod.fileCount++;

      const lower = filePath.toLowerCase();
      if (this.isTestFile(lower)) {
        mod.hasTests = true;
        mod.testFiles.push(filePath);
      }
      if (this.isEntityFile(lower)) {
        const entityName = this.extractEntityName(filePath);
        if (entityName) mod.entities.push(entityName);
      }
      if (this.isControllerOrRouteFile(lower)) {
        mod.controllers.push(filePath);
      }
      if (this.isServiceFile(lower)) {
        mod.services.push(filePath);
      }
    }

    // Enrich with descriptions from project summary
    if (report.projectSummary?.modules) {
      for (const summaryMod of report.projectSummary.modules) {
        const key = summaryMod.name.toLowerCase();
        for (const [modName, mod] of modules) {
          if (modName.toLowerCase().includes(key) || key.includes(modName.toLowerCase())) {
            mod.description = summaryMod.description;
            break;
          }
        }
      }
    }

    // Auto-generate descriptions for modules without one
    for (const mod of modules.values()) {
      if (!mod.description) {
        mod.description = this.generateModuleDescription(mod);
      }
    }

    return [...modules.values()].sort((a, b) => b.fileCount - a.fileCount);
  }

  /**
   * Multi-strategy module name inference.
   * Strategy 1: Explicit module markers (modules/, features/, apps/, etc.)
   * Strategy 2: Clean Architecture layers — use meaningful subdirectory
   * Strategy 3: Django apps pattern (app_name/models.py, app_name/views.py)
   * Strategy 4: Package-based (Java/PHP namespaces)
   * Strategy 5: Fallback — first non-generic directory from the end
   */
  private inferModuleName(filePath: string): string | null {
    const parts = filePath.split('/');
    const lower = filePath.toLowerCase();

    // Skip __init__.py / index files as standalone modules
    const fileName = parts[parts.length - 1].toLowerCase();
    if (fileName === '__init__.py' || fileName === 'index.ts' || fileName === 'index.js' || fileName === 'index.py') {
      // Only process if it's in a meaningful directory
    }

    // ── Strategy 1: Explicit module markers ──
    const moduleMarkers = ['modules', 'features', 'apps', 'domains', 'packages', 'components', 'pages', 'bundles'];
    for (let i = 0; i < parts.length; i++) {
      if (moduleMarkers.includes(parts[i].toLowerCase()) && parts[i + 1]) {
        return parts[i + 1];
      }
    }

    // ── Strategy 2: Clean Architecture / DDD layers ──
    // Pattern: .../layer/sublayer/... where layer is a DDD layer
    // The meaningful module name is the sublayer
    const cleanArchLayers = new Set([
      'domain', 'application', 'infrastructure', 'presentation',
      'core', 'adapters', 'ports', 'usecases', 'use_cases',
    ]);
    for (let i = 0; i < parts.length - 1; i++) {
      if (cleanArchLayers.has(parts[i].toLowerCase()) && parts[i + 1]) {
        const nextDir = parts[i + 1].toLowerCase();
        // If next part is a sub-layer (services, entities, etc.) look deeper
        const subLayers = new Set([
          'services', 'entities', 'models', 'repositories', 'interfaces',
          'value_objects', 'events', 'exceptions', 'enums', 'dto', 'dtos',
          'controllers', 'views', 'routes', 'api', 'workers', 'consumers',
          'persistence', 'storage', 'extraction', 'agents', 'adapters',
          'mappers', 'factories', 'providers', 'guards', 'middleware',
          'dependencies', 'schemas', 'serializers', 'signals', 'tasks',
          'commands', 'queries', 'handlers', 'listeners',
        ]);

        if (subLayers.has(nextDir)) {
          // Use the sub-layer as module if it has its own children
          if (parts[i + 2] && !parts[i + 2].includes('.')) {
            return parts[i + 2]; // e.g., infrastructure/extraction/extractors → extractors
          }
          // Otherwise use layer + sublayer
          return `${parts[i]}/${parts[i + 1]}`;
        }

        // If not a sub-layer, it's likely a domain module (e.g., domain/payment)
        if (!this.isGenericDir(nextDir) && nextDir.length > 2 && !nextDir.startsWith('__')) {
          return parts[i + 1];
        }
      }
    }

    // ── Strategy 3: Django apps pattern ──
    // If file contains views.py, models.py, urls.py, serializers.py → parent is app
    const djangoMarkers = ['views.py', 'models.py', 'urls.py', 'serializers.py', 'admin.py', 'apps.py', 'forms.py'];
    if (djangoMarkers.some(m => lower.endsWith(m))) {
      const parentDir = parts[parts.length - 2];
      if (parentDir && !this.isGenericDir(parentDir.toLowerCase())) {
        return parentDir;
      }
    }

    // ── Strategy 4: Java/PHP package-based ──
    // Pattern: com/company/module/... or App/Module/...
    const javaPackageMarkers = ['com', 'org', 'net', 'io', 'br'];
    for (let i = 0; i < parts.length; i++) {
      if (javaPackageMarkers.includes(parts[i].toLowerCase()) && parts[i + 2]) {
        // com/company/module → return module
        return parts[i + 2];
      }
    }

    // PHP namespace: App/Http/Controllers/UserController.php → user
    if (lower.includes('/http/controllers/') || lower.includes('/http/requests/')) {
      const parentDir = parts[parts.length - 2];
      if (parentDir && parentDir.toLowerCase() !== 'controllers' && parentDir.toLowerCase() !== 'requests') {
        return parentDir;
      }
      // Extract from file name: UserController.php → User
      const baseName = parts[parts.length - 1]
        .replace(/\.[^.]+$/, '')
        .replace(/(Controller|Request|Resource|Policy|Observer|Event)$/i, '');
      if (baseName.length > 2) return baseName;
    }

    // ── Strategy 5: Go package ──
    // In Go, directory = package, use parent of .go file
    if (lower.endsWith('.go')) {
      const parentDir = parts[parts.length - 2];
      if (parentDir && !this.isGenericDir(parentDir.toLowerCase()) && parentDir !== 'cmd' && parentDir !== 'internal' && parentDir !== 'pkg') {
        return parentDir;
      }
    }

    // ── Strategy 6: Fallback — walk from end, find first non-generic dir ──
    const extraGenericForFallback = new Set(['__pycache__', 'node_modules', 'dist', 'build', '.git', 'vendor', 'target']);
    for (let i = parts.length - 2; i >= 0; i--) {
      const dir = parts[i].toLowerCase();
      if (
        !this.isGenericDir(dir) &&
        !extraGenericForFallback.has(dir) &&
        dir.length > 2 &&
        !dir.startsWith('.') &&
        !dir.startsWith('__')
      ) {
        return parts[i];
      }
    }

    return null;
  }

  /** Check if a directory name is too generic to be a module */
  private isGenericDir(name: string): boolean {
    const generic = new Set([
      'src', 'lib', 'app', 'main', 'common', 'shared', 'utils', 'helpers',
      'config', 'configuration', 'middleware', 'middlewares', 'guards', 'pipes',
      'interceptors', 'filters', 'decorators',
      'tests', 'test', '__tests__', 'spec', 'specs', 'e2e', 'migrations', 'seeds',
      'dto', 'dtos', 'entities', 'models', 'schemas', 'interfaces', 'types', 'typings',
      'controllers', 'services', 'repositories', 'providers', 'factories',
      'data', 'domain', 'presentation', 'infrastructure', 'application',
      'core', 'base', 'abstract', 'generics', 'constants', 'enums',
      'public', 'static', 'assets', 'resources', 'templates', 'views',
      'internal', 'pkg', 'cmd', 'vendor', 'node_modules',
      'adapters', 'ports', 'usecases', 'use_cases', 'value_objects',
      'events', 'exceptions', 'errors', 'signals', 'hooks',
    ]);
    return generic.has(name);
  }

  private inferModulePath(filePath: string, moduleName: string): string {
    const idx = filePath.toLowerCase().indexOf(moduleName.toLowerCase());
    if (idx >= 0) {
      return filePath.substring(0, idx + moduleName.length);
    }
    return filePath.split('/').slice(0, -1).join('/');
  }

  private inferFileLayer(filePath: string): string {
    const lower = filePath.toLowerCase();

    // API / Presentation layer
    if (lower.includes('/route') || lower.includes('/controller') || lower.includes('/endpoint')
      || lower.includes('/api/') || lower.includes('/presentation/') || lower.includes('/handler')
      || lower.includes('/view') && !lower.includes('/review')
      || lower.includes('/urls') || lower.includes('/blueprint')
      || lower.includes('/http/')) return 'API';

    // Service / Application layer
    if (lower.includes('/service') || lower.includes('/usecase') || lower.includes('/use_case')
      || lower.includes('/use-case') || lower.includes('/application/')) return 'Service';

    // Data / Domain layer
    if (lower.includes('/model') || lower.includes('/entity') || lower.includes('/entities')
      || lower.includes('/schema') || lower.includes('/repository') || lower.includes('/persistence')
      || lower.includes('/migration') || lower.includes('/domain/')
      || lower.includes('/value_object') || lower.includes('/serializer')) return 'Data';

    // UI layer
    if (lower.includes('/component') || lower.includes('/page') || lower.includes('/screen')
      || lower.includes('/widget') || lower.includes('/template')
      || lower.includes('/partial') || lower.includes('/layout')) return 'UI';

    // Infrastructure
    if (lower.includes('/config') || lower.includes('/middleware') || lower.includes('/infra')
      || lower.includes('/infrastructure/') || lower.includes('/storage')
      || lower.includes('/extraction') || lower.includes('/adapter')
      || lower.includes('/worker') || lower.includes('/consumer')
      || lower.includes('/queue') || lower.includes('/cache')
      || lower.includes('/email') || lower.includes('/notification')) return 'Infrastructure';

    // CLI / Scripts
    if (lower.includes('/cli/') || lower.includes('/command') || lower.includes('/script')
      || lower.includes('/management/commands')) return 'CLI';

    return 'Other';
  }

  private generateModuleDescription(mod: ModuleDetail): string {
    const parts: string[] = [];
    if (mod.controllers.length > 0) parts.push(`${mod.controllers.length} route(s)`);
    if (mod.services.length > 0) parts.push(`${mod.services.length} service(s)`);
    if (mod.entities.length > 0) parts.push(`entities: ${mod.entities.join(', ')}`);
    parts.push(`${mod.fileCount} file(s)`);
    return parts.join(' · ');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ENDPOINT EXTRACTION — Multi-framework
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Extract API endpoints from controller/router/view files.
   * Detects FastAPI, NestJS, Express, Django, Flask, Spring, Laravel patterns.
   */
  private extractEndpoints(report: AnalysisReport, modules: ModuleDetail[]): DetectedEndpoint[] {
    const endpoints: DetectedEndpoint[] = [];
    const nodes = report.dependencyGraph.nodes;

    for (const filePath of nodes) {
      const lower = filePath.toLowerCase();
      if (!this.isControllerOrRouteFile(lower)) continue;

      // Extract resource name from file
      const resourceName = this.extractResourceFromFile(filePath);
      if (!resourceName || resourceName === 'init' || resourceName === 'index') continue;

      // Infer endpoint style based on file patterns
      const isAuthRoute = lower.includes('auth');
      const isHealthRoute = lower.includes('health') || lower.includes('status');
      const isSearchRoute = lower.includes('search') || lower.includes('query');
      const isMetricsRoute = lower.includes('metric') || lower.includes('monitor');

      if (isHealthRoute) {
        endpoints.push({
          method: 'GET', path: `/health`, file: filePath,
          handler: 'health_check', hasAuth: false, hasValidation: false,
        });
        continue;
      }

      if (isMetricsRoute) {
        endpoints.push({
          method: 'GET', path: `/metrics`, file: filePath,
          handler: 'get_metrics', hasAuth: this.fileReferencesAuth(filePath, report), hasValidation: false,
        });
        continue;
      }

      if (isAuthRoute) {
        endpoints.push(
          { method: 'POST', path: `/auth/login`, file: filePath, handler: 'login', hasAuth: false, hasValidation: true },
          { method: 'POST', path: `/auth/register`, file: filePath, handler: 'register', hasAuth: false, hasValidation: true },
          { method: 'POST', path: `/auth/refresh`, file: filePath, handler: 'refresh_token', hasAuth: true, hasValidation: false },
        );
        continue;
      }

      if (isSearchRoute) {
        endpoints.push({
          method: 'GET', path: `/${resourceName}/search`, file: filePath,
          handler: `search_${resourceName}`, hasAuth: this.fileReferencesAuth(filePath, report), hasValidation: true,
        });
        endpoints.push({
          method: 'POST', path: `/${resourceName}/search`, file: filePath,
          handler: `advanced_search_${resourceName}`, hasAuth: this.fileReferencesAuth(filePath, report), hasValidation: true,
        });
        continue;
      }

      // Standard CRUD
      const hasAuth = this.fileReferencesAuth(filePath, report);
      const hasValidation = this.fileReferencesValidation(filePath, report);
      const crud = [
        { method: 'GET', path: `/${resourceName}`, handler: `list_${resourceName}` },
        { method: 'GET', path: `/${resourceName}/{id}`, handler: `get_${resourceName}` },
        { method: 'POST', path: `/${resourceName}`, handler: `create_${resourceName}` },
        { method: 'PUT', path: `/${resourceName}/{id}`, handler: `update_${resourceName}` },
        { method: 'DELETE', path: `/${resourceName}/{id}`, handler: `delete_${resourceName}` },
      ];
      for (const c of crud) {
        endpoints.push({ method: c.method, path: c.path, file: filePath, handler: c.handler, hasAuth, hasValidation });
      }
    }

    return endpoints;
  }

  private extractResourceFromFile(filePath: string): string {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1]
      .replace(/\.[^.]+$/, '')           // remove extension
      .replace(/(Controller|Router|Route|View|Handler|Endpoint|Resource|Blueprint)$/i, '')  // remove suffixes
      .replace(/[-_]/g, '')              // normalize
      .toLowerCase();

    if (fileName && fileName !== '__init__' && fileName !== 'index' && fileName !== 'base' && fileName.length > 1) {
      return fileName;
    }

    // If __init__.py or index.ts, use parent directory
    const parent = parts[parts.length - 2];
    if (parent && parent.toLowerCase() !== 'routes' && parent.toLowerCase() !== 'controllers') {
      return parent.toLowerCase().replace(/[-_]/g, '');
    }

    return '';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TEST & COUPLING ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════

  private findUntestedModules(modules: ModuleDetail[]): string[] {
    return modules
      .filter(m => !m.hasTests && m.fileCount > 1)
      .map(m => m.name);
  }

  private findCriticalPaths(report: AnalysisReport): string[] {
    const coupling = new Map<string, number>();
    for (const edge of report.dependencyGraph.edges) {
      coupling.set(edge.from, (coupling.get(edge.from) || 0) + edge.weight);
      coupling.set(edge.to, (coupling.get(edge.to) || 0) + edge.weight);
    }
    return [...coupling.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file]) => file);
  }

  private classifyProjectDepth(report: AnalysisReport): EnrichedTemplateContext['projectDepth'] {
    const files = report.projectInfo.totalFiles;
    const lines = report.projectInfo.totalLines;
    if (files > 500 || lines > 100000) return 'enterprise';
    if (files > 200 || lines > 50000) return 'large';
    if (files > 50 || lines > 10000) return 'medium';
    return 'small';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILE CLASSIFICATION HELPERS — Multi-stack
  // ═══════════════════════════════════════════════════════════════════════

  private isTestFile(lower: string): boolean {
    return lower.includes('/test') || lower.includes('/spec') || lower.includes('__tests__')
      || lower.includes('.test.') || lower.includes('.spec.')
      || lower.includes('_test.py') || lower.includes('_test.go')
      || lower.includes('test_') && lower.endsWith('.py')
      || lower.includes('/tests/');
  }

  private isEntityFile(lower: string): boolean {
    return lower.includes('/model') || lower.includes('/entity') || lower.includes('/entities')
      || lower.includes('/schema') || lower.includes('/value_object')
      || lower.includes('.model.') || lower.includes('.entity.')
      // Python models
      || lower.endsWith('models.py')
      // Java entities
      || lower.includes('/domain/') && (lower.endsWith('.java') || lower.endsWith('.kt')) && !lower.includes('service') && !lower.includes('repository')
      // PHP models
      || lower.includes('/models/') && lower.endsWith('.php');
  }

  private isControllerOrRouteFile(lower: string): boolean {
    // TypeScript / NestJS / Express
    if (lower.includes('.controller.')) return true;
    if (lower.includes('.router.')) return true;

    // Python — FastAPI routes, Django views, Flask blueprints
    if (lower.includes('/routes/') && !lower.includes('__init__')) return true;
    if (lower.includes('/route/') && !lower.includes('__init__')) return true;
    if (lower.endsWith('views.py') || lower.endsWith('_view.py')) return true;
    if (lower.endsWith('urls.py')) return true;
    if (lower.includes('blueprint')) return true;

    // Java / Kotlin — Spring controllers
    if ((lower.endsWith('.java') || lower.endsWith('.kt')) && lower.includes('controller')) return true;

    // PHP — Laravel controllers
    if (lower.includes('/controllers/') && lower.endsWith('.php')) return true;

    // Go — handlers
    if (lower.endsWith('.go') && (lower.includes('handler') || lower.includes('router'))) return true;

    // Ruby — Rails controllers
    if (lower.includes('/controllers/') && lower.endsWith('.rb')) return true;

    // Generic
    if (lower.includes('/endpoint') || lower.includes('/handler')) return true;

    return false;
  }

  private isServiceFile(lower: string): boolean {
    return lower.includes('service') || lower.includes('usecase') || lower.includes('use_case')
      || lower.includes('use-case') || lower.includes('interactor')
      || lower.includes('/application/') && !lower.includes('interface') && !lower.includes('__init__');
  }

  private extractEntityName(filePath: string): string | null {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    const name = fileName
      .replace(/\.[^.]+$/, '')                         // remove extension
      .replace(/\.(model|entity|schema|dto)$/i, '')    // remove type suffix
      .replace(/(Model|Entity|Schema|Dto)$/i, '')      // remove PascalCase suffix
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();

    const skip = new Set(['Index', 'Base', 'Init', '__Init__', 'Abstract', 'Models', 'Entities', 'Schemas']);
    if (name && !skip.has(name)) {
      return name;
    }
    return null;
  }

  private fileReferencesAuth(filePath: string, report: AnalysisReport): boolean {
    const edges = report.dependencyGraph.edges.filter(e => e.from === filePath);
    return edges.some(e => {
      const to = e.to.toLowerCase();
      return to.includes('auth') || to.includes('guard') || to.includes('permission')
        || to.includes('jwt') || to.includes('token') || to.includes('security')
        || to.includes('dependencies/auth') || to.includes('middleware/auth');
    });
  }

  private fileReferencesValidation(filePath: string, report: AnalysisReport): boolean {
    const edges = report.dependencyGraph.edges.filter(e => e.from === filePath);
    return edges.some(e => {
      const to = e.to.toLowerCase();
      return to.includes('dto') || to.includes('schema') || to.includes('validator')
        || to.includes('pipe') || to.includes('serializer') || to.includes('form')
        || to.includes('pydantic') || to.includes('marshmallow');
    });
  }
}
