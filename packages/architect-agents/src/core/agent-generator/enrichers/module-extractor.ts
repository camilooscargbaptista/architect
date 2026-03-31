// import { existsSync, readFileSync, statSync } from 'fs';
// import { join } from 'path';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { ModuleDetail} from '@girardelli/architect-agents/src/core/agent-generator/types/domain.js';
// import { EnrichedTemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';

import { LayerClassifier } from './layer-classifier.js';
import { DescriptionGenerator } from './description-generator.js';
import { AnalysisHelpers } from './analysis-helpers.js';

export class ModuleExtractor {
  private layerClassifier = new LayerClassifier();
  private descriptionGenerator = new DescriptionGenerator();
  private analysisHelpers = new AnalysisHelpers();

public extractModules(report: AnalysisReport, projectPath: string): ModuleDetail[] {
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
          layer: this.layerClassifier.inferFileLayer(filePath),
        });
      }

      const mod = modules.get(moduleName)!;
      mod.files.push(filePath);
      mod.fileCount++;

      // v3.1: Count real lines
      mod.lineCount += this.analysisHelpers.countFileLines(projectPath, filePath);

      const lower = filePath.toLowerCase();
      if (this.layerClassifier.isTestFile(lower)) {
        mod.hasTests = true;
        mod.testFiles.push(filePath);
      }
      if (this.layerClassifier.isEntityFile(lower)) {
        const entityName = this.layerClassifier.extractEntityName(filePath);
        if (entityName) mod.entities.push(entityName);
      }
      if (this.layerClassifier.isControllerOrRouteFile(lower)) {
        mod.controllers.push(filePath);
      }
      if (this.layerClassifier.isServiceFile(lower)) {
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

    // v3.1: Smart descriptions for modules without one
    for (const mod of modules.values()) {
      if (!mod.description) {
        mod.description = this.descriptionGenerator.generateSmartDescription(mod);
      }
    }

    return [...modules.values()].sort((a, b) => b.fileCount - a.fileCount);
  }


public inferModuleName(filePath: string): string | null {
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
    const cleanArchLayers = new Set([
      'domain', 'application', 'infrastructure', 'presentation',
      'core', 'adapters', 'ports', 'usecases', 'use_cases',
    ]);
    for (let i = 0; i < parts.length - 1; i++) {
      if (cleanArchLayers.has(parts[i].toLowerCase()) && parts[i + 1]) {
        const nextDir = parts[i + 1].toLowerCase();
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
          if (parts[i + 2] && !parts[i + 2].includes('.')) {
            return parts[i + 2]; // e.g., infrastructure/extraction/extractors → extractors
          }
          return `${parts[i]}/${parts[i + 1]}`;
        }

        if (!this.layerClassifier.isGenericDir(nextDir) && nextDir.length > 2 && !nextDir.startsWith('__')) {
          return parts[i + 1];
        }
      }
    }

    // ── Strategy 3: Django apps pattern ──
    const djangoMarkers = ['views.py', 'models.py', 'urls.py', 'serializers.py', 'admin.py', 'apps.py', 'forms.py'];
    if (djangoMarkers.some(m => lower.endsWith(m))) {
      const parentDir = parts[parts.length - 2];
      if (parentDir && !this.layerClassifier.isGenericDir(parentDir.toLowerCase())) {
        return parentDir;
      }
    }

    // ── Strategy 4: Java/PHP package-based ──
    const javaPackageMarkers = ['com', 'org', 'net', 'io', 'br'];
    for (let i = 0; i < parts.length; i++) {
      if (javaPackageMarkers.includes(parts[i].toLowerCase()) && parts[i + 2]) {
        return parts[i + 2];
      }
    }

    // PHP namespace: App/Http/Controllers/UserController.php → user
    if (lower.includes('/http/controllers/') || lower.includes('/http/requests/')) {
      const parentDir = parts[parts.length - 2];
      if (parentDir && parentDir.toLowerCase() !== 'controllers' && parentDir.toLowerCase() !== 'requests') {
        return parentDir;
      }
      const baseName = parts[parts.length - 1]
        .replace(/\.[^.]+$/, '')
        .replace(/(Controller|Request|Resource|Policy|Observer|Event)$/i, '');
      if (baseName.length > 2) return baseName;
    }

    // ── Strategy 5: Go package ──
    if (lower.endsWith('.go')) {
      const parentDir = parts[parts.length - 2];
      if (parentDir && !this.layerClassifier.isGenericDir(parentDir.toLowerCase()) && parentDir !== 'cmd' && parentDir !== 'internal' && parentDir !== 'pkg') {
        return parentDir;
      }
    }

    // ── Strategy 6: Fallback — walk from end, find first non-generic dir ──
    const extraGenericForFallback = new Set(['__pycache__', 'node_modules', 'dist', 'build', '.git', 'vendor', 'target']);
    for (let i = parts.length - 2; i >= 0; i--) {
      const dir = parts[i].toLowerCase();
      if (
        !this.layerClassifier.isGenericDir(dir) &&
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


public inferModulePath(filePath: string, moduleName: string): string {
    const idx = filePath.toLowerCase().indexOf(moduleName.toLowerCase());
    if (idx >= 0) {
      return filePath.substring(0, idx + moduleName.length);
    }
    return filePath.split('/').slice(0, -1).join('/');
  }


}
