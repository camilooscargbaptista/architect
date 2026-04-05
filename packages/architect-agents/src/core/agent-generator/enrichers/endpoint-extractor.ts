// import { existsSync, readFileSync, statSync } from 'fs';
// import { join } from 'path';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { ModuleDetail, DetectedEndpoint } from '@girardelli/architect-agents/src/core/agent-generator/types/domain.js';
// import { EnrichedTemplateContext } from '@girardelli/architect-agents/src/core/agent-generator/types/template.js';

import { LayerClassifier } from './layer-classifier.js';

export class EndpointExtractor {
  private layerClassifier = new LayerClassifier();

public extractEndpoints(report: AnalysisReport, _modules: ModuleDetail[]): DetectedEndpoint[] {
    const endpoints: DetectedEndpoint[] = [];
    const nodes = report.dependencyGraph.nodes;

    for (const filePath of nodes) {
      const lower = filePath.toLowerCase();
      if (!this.layerClassifier.isControllerOrRouteFile(lower)) continue;

      const resourceName = this.extractResourceFromFile(filePath);
      if (!resourceName || resourceName === 'init' || resourceName === 'index') continue;

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
          handler: 'get_metrics', hasAuth: this.layerClassifier.fileReferencesAuth(filePath, report), hasValidation: false,
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
          handler: `search_${resourceName}`, hasAuth: this.layerClassifier.fileReferencesAuth(filePath, report), hasValidation: true,
        });
        endpoints.push({
          method: 'POST', path: `/${resourceName}/search`, file: filePath,
          handler: `advanced_search_${resourceName}`, hasAuth: this.layerClassifier.fileReferencesAuth(filePath, report), hasValidation: true,
        });
        continue;
      }

      // Standard CRUD
      const hasAuth = this.layerClassifier.fileReferencesAuth(filePath, report);
      const hasValidation = this.layerClassifier.fileReferencesValidation(filePath, report);
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

    // Deduplicate endpoints — same method+path from .ts and .js variants
    const seen = new Set<string>();
    const deduped = endpoints.filter(ep => {
      const key = `${ep.method}:${ep.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return deduped;
  }


public extractResourceFromFile(filePath: string): string {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1]!
      .replace(/\.[^.]+$/, '')
      .replace(/(Controller|Router|Route|View|Handler|Endpoint|Resource|Blueprint)$/i, '')
      .replace(/[-_]/g, '')
      .toLowerCase();

    if (fileName && fileName !== '__init__' && fileName !== 'index' && fileName !== 'base' && fileName.length > 1) {
      return fileName;
    }

    const parent = parts[parts.length - 2];
    if (parent && parent.toLowerCase() !== 'routes' && parent.toLowerCase() !== 'controllers') {
      return parent.toLowerCase().replace(/[-_]/g, '');
    }

    return '';
  }


}
