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
 * Extracts detailed module maps, API endpoints, test coverage gaps,
 * critical coupling paths, and domain insights to feed context-aware templates.
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
    const endpoints = this.extractEndpoints(report);
    const untestedModules = this.findUntestedModules(modules);
    const criticalPaths = this.findCriticalPaths(report);
    const projectDepth = this.classifyProjectDepth(report);
    const domain = this.domainInferrer.infer(report, projectPath);

    return {
      // Base TemplateContext fields
      report,
      plan,
      stack,
      projectName: report.projectInfo.name || 'Project',
      stackLabel: [...stack.languages, ...stack.frameworks].join(' + '),
      config,
      // Enriched fields
      domain,
      modules,
      endpoints,
      untestedModules,
      criticalPaths,
      projectDepth,
    };
  }

  /**
   * Extract module details from the dependency graph and project structure.
   */
  private extractModules(report: AnalysisReport): ModuleDetail[] {
    const modules = new Map<string, ModuleDetail>();
    const nodes = report.dependencyGraph.nodes;

    for (const filePath of nodes) {
      const moduleName = this.inferModuleName(filePath);
      if (!moduleName) continue;

      if (!modules.has(moduleName)) {
        modules.set(moduleName, {
          name: moduleName,
          path: this.inferModulePath(filePath),
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

      // Classify file role within the module
      const lower = filePath.toLowerCase();
      if (this.isTestFile(lower)) {
        mod.hasTests = true;
        mod.testFiles.push(filePath);
      }
      if (this.isEntityFile(lower)) {
        const entityName = this.extractEntityName(filePath);
        if (entityName) mod.entities.push(entityName);
      }
      if (this.isControllerFile(lower)) {
        mod.controllers.push(filePath);
      }
      if (this.isServiceFile(lower)) {
        mod.services.push(filePath);
      }
    }

    // Enrich with line counts from project summary modules
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

    return [...modules.values()].sort((a, b) => b.fileCount - a.fileCount);
  }

  /**
   * Extract API endpoints from controller/router file patterns.
   */
  private extractEndpoints(report: AnalysisReport): DetectedEndpoint[] {
    const endpoints: DetectedEndpoint[] = [];
    const nodes = report.dependencyGraph.nodes;

    for (const filePath of nodes) {
      const lower = filePath.toLowerCase();
      if (!this.isControllerFile(lower) && !this.isRouterFile(lower)) continue;

      // Infer endpoints from file name patterns
      const moduleName = this.inferModuleName(filePath) || 'unknown';
      const resourceName = moduleName.toLowerCase().replace(/[-_]/g, '');

      // Standard CRUD endpoints inferred from controller/router presence
      const methods: { method: string; pathSuffix: string; handler: string }[] = [
        { method: 'GET', pathSuffix: '', handler: `list${moduleName}` },
        { method: 'GET', pathSuffix: '/:id', handler: `get${moduleName}` },
        { method: 'POST', pathSuffix: '', handler: `create${moduleName}` },
        { method: 'PUT', pathSuffix: '/:id', handler: `update${moduleName}` },
        { method: 'DELETE', pathSuffix: '/:id', handler: `delete${moduleName}` },
      ];

      for (const m of methods) {
        endpoints.push({
          method: m.method,
          path: `/${resourceName}${m.pathSuffix}`,
          file: filePath,
          handler: m.handler,
          hasAuth: this.fileReferencesAuth(filePath, report),
          hasValidation: this.fileReferencesValidation(filePath, report),
        });
      }
    }

    return endpoints;
  }

  /**
   * Identify modules without test coverage.
   */
  private findUntestedModules(modules: ModuleDetail[]): string[] {
    return modules
      .filter(m => !m.hasTests && m.fileCount > 1)
      .map(m => m.name);
  }

  /**
   * Find files with highest coupling (most incoming + outgoing edges).
   */
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

  /**
   * Classify project size/depth for template verbosity scaling.
   */
  private classifyProjectDepth(report: AnalysisReport): EnrichedTemplateContext['projectDepth'] {
    const files = report.projectInfo.totalFiles;
    const lines = report.projectInfo.totalLines;

    if (files > 500 || lines > 100000) return 'enterprise';
    if (files > 200 || lines > 50000) return 'large';
    if (files > 50 || lines > 10000) return 'medium';
    return 'small';
  }

  // ── Helper methods ──

  private inferModuleName(filePath: string): string | null {
    const parts = filePath.split('/');

    // Look for common module directory patterns
    const moduleMarkers = ['modules', 'features', 'apps', 'domains', 'packages', 'components', 'pages'];
    for (let i = 0; i < parts.length; i++) {
      if (moduleMarkers.includes(parts[i].toLowerCase()) && parts[i + 1]) {
        return parts[i + 1];
      }
    }

    // Fallback: use second-to-last directory if it's not a generic name
    const genericDirs = new Set([
      'src', 'lib', 'app', 'core', 'common', 'shared', 'utils', 'helpers',
      'config', 'middleware', 'guards', 'pipes', 'interceptors', 'filters',
      'tests', 'test', '__tests__', 'spec', 'e2e', 'migrations',
      'dto', 'entities', 'models', 'schemas', 'interfaces', 'types',
      'controllers', 'services', 'repositories', 'providers',
      'data', 'domain', 'presentation', 'infrastructure',
    ]);

    for (let i = parts.length - 2; i >= 0; i--) {
      const dir = parts[i].toLowerCase();
      if (!genericDirs.has(dir) && dir.length > 1 && !dir.startsWith('.') && !dir.startsWith('__')) {
        return parts[i];
      }
    }

    return null;
  }

  private inferModulePath(filePath: string): string {
    const parts = filePath.split('/');
    const moduleMarkers = ['modules', 'features', 'apps', 'domains', 'packages'];
    for (let i = 0; i < parts.length; i++) {
      if (moduleMarkers.includes(parts[i].toLowerCase()) && parts[i + 1]) {
        return parts.slice(0, i + 2).join('/');
      }
    }
    return parts.slice(0, -1).join('/');
  }

  private inferFileLayer(filePath: string): string {
    const lower = filePath.toLowerCase();
    if (lower.includes('/controller') || lower.includes('/router') || lower.includes('/view') || lower.includes('/endpoint')) return 'API';
    if (lower.includes('/service') || lower.includes('/usecase') || lower.includes('/use-case')) return 'Service';
    if (lower.includes('/model') || lower.includes('/entity') || lower.includes('/schema') || lower.includes('/repository')) return 'Data';
    if (lower.includes('/component') || lower.includes('/page') || lower.includes('/screen') || lower.includes('/widget')) return 'UI';
    if (lower.includes('/config') || lower.includes('/middleware') || lower.includes('/migration') || lower.includes('/infra')) return 'Infrastructure';
    return 'Other';
  }

  private isTestFile(lower: string): boolean {
    return lower.includes('test') || lower.includes('spec') || lower.includes('__tests__');
  }

  private isEntityFile(lower: string): boolean {
    return lower.includes('/model') || lower.includes('/entity') || lower.includes('/entities')
      || lower.includes('/schema') || lower.includes('.model.') || lower.includes('.entity.');
  }

  private isControllerFile(lower: string): boolean {
    return lower.includes('controller') || lower.includes('view') && !lower.includes('review');
  }

  private isRouterFile(lower: string): boolean {
    return lower.includes('router') || lower.includes('route') || lower.includes('urls');
  }

  private isServiceFile(lower: string): boolean {
    return lower.includes('service') || lower.includes('usecase') || lower.includes('use-case');
  }

  private extractEntityName(filePath: string): string | null {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    const name = fileName
      .replace(/\.[^.]+$/, '')
      .replace(/\.(model|entity|schema|dto)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();

    if (name && name !== 'Index' && name !== 'Base' && name !== 'Init') {
      return name;
    }
    return null;
  }

  private fileReferencesAuth(filePath: string, report: AnalysisReport): boolean {
    // Check if auth-related files are in the dependency graph for this file
    const edges = report.dependencyGraph.edges.filter(e => e.from === filePath);
    return edges.some(e =>
      e.to.toLowerCase().includes('auth') ||
      e.to.toLowerCase().includes('guard') ||
      e.to.toLowerCase().includes('permission')
    );
  }

  private fileReferencesValidation(filePath: string, report: AnalysisReport): boolean {
    const edges = report.dependencyGraph.edges.filter(e => e.from === filePath);
    return edges.some(e =>
      e.to.toLowerCase().includes('dto') ||
      e.to.toLowerCase().includes('schema') ||
      e.to.toLowerCase().includes('validator') ||
      e.to.toLowerCase().includes('pipe')
    );
  }
}
