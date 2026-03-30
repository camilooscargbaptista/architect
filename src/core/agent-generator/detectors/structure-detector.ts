import { AnalysisReport } from '../../types/core.js';

export class StructureDetector {
  public detectProjectStructure(report: AnalysisReport): 'clean-architecture' | 'mvc' | 'modular' | 'flat' | 'monorepo' | 'unknown' {
    const paths = report.dependencyGraph.nodes.map(n => n.toLowerCase());

    // Clean Architecture / DDD
    const hasDomain = paths.some(p => p.includes('/domain/'));
    const hasApplication = paths.some(p => p.includes('/application/'));
    const hasInfrastructure = paths.some(p => p.includes('/infrastructure/'));
    const hasPresentation = paths.some(p => p.includes('/presentation/'));
    if ((hasDomain && hasInfrastructure) || (hasDomain && hasApplication && hasPresentation)) {
      return 'clean-architecture';
    }

    // MVC
    const hasModels = paths.some(p => p.includes('/models/'));
    const hasViews = paths.some(p => p.includes('/views/'));
    const hasControllers = paths.some(p => p.includes('/controllers/'));
    if (hasModels && hasViews && hasControllers) return 'mvc';

    // Modular (NestJS, feature-based)
    const hasModules = paths.some(p => p.includes('/modules/'));
    const hasFeatures = paths.some(p => p.includes('/features/'));
    if (hasModules || hasFeatures) return 'modular';

    // Monorepo
    const hasPackages = paths.some(p => p.includes('/packages/'));
    const hasApps = paths.some(p => p.includes('/apps/'));
    if (hasPackages || hasApps) return 'monorepo';

    // Flat
    const maxDepth = Math.max(...paths.map(p => p.split('/').length));
    if (maxDepth <= 3) return 'flat';

    return 'unknown';
  }
}
