// import { existsSync, readFileSync, statSync } from 'fs';
// import { join } from 'path';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
// import { ModuleDetail, DetectedEndpoint } from '@girardelli/architect-agents/src/core/agent-generator/types/domain.js';
// import { EnrichedTemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';

export class LayerClassifier {
public isTestFile(lower: string): boolean {
    return lower.includes('/test') || lower.includes('/spec') || lower.includes('__tests__')
      || lower.includes('.test.') || lower.includes('.spec.')
      || lower.includes('_test.py') || lower.includes('_test.go')
      || lower.includes('test_') && lower.endsWith('.py')
      || lower.includes('/tests/');
  }


public isEntityFile(lower: string): boolean {
    return lower.includes('/model') || lower.includes('/entity') || lower.includes('/entities')
      || lower.includes('/schema') || lower.includes('/value_object')
      || lower.includes('.model.') || lower.includes('.entity.')
      || lower.endsWith('models.py')
      || lower.includes('/domain/') && (lower.endsWith('.java') || lower.endsWith('.kt')) && !lower.includes('service') && !lower.includes('repository')
      || lower.includes('/models/') && lower.endsWith('.php');
  }


public isControllerOrRouteFile(lower: string): boolean {
    if (lower.includes('.controller.')) return true;
    if (lower.includes('.router.')) return true;
    if (lower.includes('/routes/') && !lower.includes('__init__')) return true;
    if (lower.includes('/route/') && !lower.includes('__init__')) return true;
    if (lower.endsWith('views.py') || lower.endsWith('_view.py')) return true;
    if (lower.endsWith('urls.py')) return true;
    if (lower.includes('blueprint')) return true;
    if ((lower.endsWith('.java') || lower.endsWith('.kt')) && lower.includes('controller')) return true;
    if (lower.includes('/controllers/') && lower.endsWith('.php')) return true;
    if (lower.endsWith('.go') && (lower.includes('handler') || lower.includes('router'))) return true;
    if (lower.includes('/controllers/') && lower.endsWith('.rb')) return true;
    if (lower.includes('/endpoint') || lower.includes('/handler')) return true;
    return false;
  }


public isServiceFile(lower: string): boolean {
    return lower.includes('service') || lower.includes('usecase') || lower.includes('use_case')
      || lower.includes('use-case') || lower.includes('interactor')
      || lower.includes('/application/') && !lower.includes('interface') && !lower.includes('__init__');
  }


public isGenericDir(name: string): boolean {
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


public inferFileLayer(filePath: string): string {
    const lower = filePath.toLowerCase();

    // Monorepo package-level classification
    const packagesMatch = lower.match(/packages\/([^/]+)/);
    if (packagesMatch) {
      const pkgName = packagesMatch[1]!;
      // Classify by package name semantics
      if (['dashboard', 'web', 'frontend', 'app', 'ui'].includes(pkgName)) return 'UI';
      if (['api', 'cloud', 'server', 'backend'].includes(pkgName)) return 'API';
      if (['core', 'bridge', 'engine'].includes(pkgName)) return 'Service';
      if (['cli', 'command'].includes(pkgName)) return 'CLI';
      if (['types', 'events', 'mcp', 'autonomy'].includes(pkgName)) return 'Infrastructure';
      return 'Package';
    }

    if (lower.includes('/route') || lower.includes('/controller') || lower.includes('/endpoint')
      || lower.includes('/api/') || lower.includes('/presentation/') || lower.includes('/handler')
      || (lower.includes('/view') && !lower.includes('/review'))
      || lower.includes('/urls') || lower.includes('/blueprint')
      || lower.includes('/http/')) return 'API';

    if (lower.includes('/service') || lower.includes('/usecase') || lower.includes('/use_case')
      || lower.includes('/use-case') || lower.includes('/application/')) return 'Service';

    if (lower.includes('/model') || lower.includes('/entity') || lower.includes('/entities')
      || lower.includes('/schema') || lower.includes('/repository') || lower.includes('/persistence')
      || lower.includes('/migration') || lower.includes('/domain/')
      || lower.includes('/value_object') || lower.includes('/serializer')) return 'Data';

    if (lower.includes('/component') || lower.includes('/page') || lower.includes('/screen')
      || lower.includes('/widget') || lower.includes('/template')
      || lower.includes('/partial') || lower.includes('/layout')) return 'UI';

    if (lower.includes('/config') || lower.includes('/middleware') || lower.includes('/infra')
      || lower.includes('/infrastructure/') || lower.includes('/storage')
      || lower.includes('/extraction') || lower.includes('/adapter')
      || lower.includes('/worker') || lower.includes('/consumer')
      || lower.includes('/queue') || lower.includes('/cache')
      || lower.includes('/email') || lower.includes('/notification')) return 'Infrastructure';

    if (lower.includes('/cli/') || lower.includes('/command') || lower.includes('/script')
      || lower.includes('/management/commands')) return 'CLI';

    return 'Other';
  }


public extractEntityName(filePath: string): string | null {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1]!;
    const name = fileName
      .replace(/\.[^.]+$/, '')
      .replace(/\.(model|entity|schema|dto)$/i, '')
      .replace(/(Model|Entity|Schema|Dto)$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();

    const skip = new Set(['Index', 'Base', 'Init', '__Init__', 'Abstract', 'Models', 'Entities', 'Schemas']);
    if (name && !skip.has(name)) {
      return name;
    }
    return null;
  }


public fileReferencesAuth(filePath: string, report: AnalysisReport): boolean {
    const edges = report.dependencyGraph.edges.filter(e => e.from === filePath);
    return edges.some(e => {
      const to = e.to.toLowerCase();
      return to.includes('auth') || to.includes('guard') || to.includes('permission')
        || to.includes('jwt') || to.includes('token') || to.includes('security')
        || to.includes('dependencies/auth') || to.includes('middleware/auth');
    });
  }

  public fileReferencesValidation(filePath: string, report: AnalysisReport): boolean {
    const edges = report.dependencyGraph.edges.filter(e => e.from === filePath);
    return edges.some(e => {
      const to = e.to.toLowerCase();
      return to.includes('dto') || to.includes('schema') || to.includes('validator')
        || to.includes('pipe') || to.includes('serializer') || to.includes('form')
        || to.includes('pydantic') || to.includes('marshmallow');
    });
  }
}
