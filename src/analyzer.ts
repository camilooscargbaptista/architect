import { readFileSync } from 'fs';
import { extname, relative, dirname } from 'path';
import { DependencyEdge, Layer, FileNode } from './types.js';

export class ArchitectureAnalyzer {
  private projectPath: string;
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private fileExtensions: Map<string, string> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  analyzeDependencies(fileTree: FileNode): DependencyEdge[] {
    this.buildDependencyGraph(fileTree);
    return this.buildEdgeList();
  }

  detectLayers(fileTree: FileNode): Layer[] {
    const layers: Layer[] = [];
    const apiFiles: string[] = [];
    const serviceFiles: string[] = [];
    const dataFiles: string[] = [];
    const uiFiles: string[] = [];
    const infraFiles: string[] = [];

    this.categorizeFiles(fileTree, apiFiles, serviceFiles, dataFiles, uiFiles, infraFiles);

    if (apiFiles.length > 0) {
      layers.push({
        name: 'API',
        files: apiFiles,
        description: 'API layer - handles external interfaces and routing',
      });
    }

    if (serviceFiles.length > 0) {
      layers.push({
        name: 'Service',
        files: serviceFiles,
        description: 'Service layer - business logic and orchestration',
      });
    }

    if (dataFiles.length > 0) {
      layers.push({
        name: 'Data',
        files: dataFiles,
        description: 'Data layer - database access and persistence',
      });
    }

    if (uiFiles.length > 0) {
      layers.push({
        name: 'UI',
        files: uiFiles,
        description: 'UI layer - user interface components and views',
      });
    }

    if (infraFiles.length > 0) {
      layers.push({
        name: 'Infrastructure',
        files: infraFiles,
        description: 'Infrastructure layer - configuration and setup',
      });
    }

    return layers;
  }

  private buildDependencyGraph(node: FileNode): void {
    if (node.type === 'file') {
      const imports = this.parseImports(node.path);
      this.dependencyGraph.set(node.path, new Set(imports));
    }

    if (node.children) {
      for (const child of node.children) {
        this.buildDependencyGraph(child);
      }
    }
  }

  private parseImports(filePath: string): string[] {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const ext = extname(filePath);
      const imports: string[] = [];

      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        const importRegex =
          /(?:import|require)\s*(?:\{[^}]+\}|[^\s]+)\s*from\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
      } else if (ext === '.py') {
        const importRegex =
          /(?:from|import)\s+(?:[^\s]+)\s*(?:import\s+)?([^\n]+)?/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          if (match[1]) {
            imports.push(match[1].trim());
          }
        }
      } else if (ext === '.java') {
        const importRegex = /import\s+([^\s;]+);/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
          imports.push(match[1]);
        }
      }

      return imports;
    } catch {
      return [];
    }
  }

  private buildEdgeList(): DependencyEdge[] {
    const edges: DependencyEdge[] = [];
    const seenEdges = new Set<string>();

    for (const [from, toSet] of this.dependencyGraph.entries()) {
      for (const to of toSet) {
        const edgeKey = `${from}->${to}`;
        if (!seenEdges.has(edgeKey)) {
          edges.push({
            from,
            to,
            type: 'import',
            weight: 1,
          });
          seenEdges.add(edgeKey);
        }
      }
    }

    return edges;
  }

  private categorizeFiles(
    node: FileNode,
    apiFiles: string[],
    serviceFiles: string[],
    dataFiles: string[],
    uiFiles: string[],
    infraFiles: string[]
  ): void {
    if (node.type === 'file') {
      const path = node.path.toLowerCase();
      const name = node.name.toLowerCase();

      // Data layer — check first (more specific patterns)
      if (
        path.includes('/entities/') ||
        path.includes('/entity/') ||
        path.includes('/migrations/') ||
        path.includes('/migration/') ||
        path.includes('/seeds/') ||
        path.includes('/seeders/') ||
        path.includes('/data/') ||
        path.includes('/db/') ||
        path.includes('/database/') ||
        path.includes('/models/') ||
        path.includes('/schema/') ||
        path.includes('/subscribers/') ||
        name.endsWith('.entity.ts') ||
        name.endsWith('.entity.js') ||
        name.endsWith('.model.ts') ||
        name.endsWith('.model.js') ||
        name.includes('repository') ||
        name.includes('dao') ||
        name.includes('mapper') ||
        name.includes('migration') ||
        name.includes('seed') ||
        name.includes('subscriber')
      ) {
        dataFiles.push(node.path);
      }
      // Infrastructure layer
      else if (
        path.includes('/config/') ||
        path.includes('/infra/') ||
        path.includes('/infrastructure/') ||
        path.includes('/setup/') ||
        path.includes('/guards/') ||
        path.includes('/pipes/') ||
        path.includes('/interceptors/') ||
        path.includes('/filters/') ||
        path.includes('/decorators/') ||
        path.includes('/middleware/') ||
        path.includes('/middlewares/') ||
        path.includes('/common/') ||
        path.includes('/shared/') ||
        path.includes('docker') ||
        path.includes('kubernetes') ||
        name.endsWith('.guard.ts') ||
        name.endsWith('.pipe.ts') ||
        name.endsWith('.interceptor.ts') ||
        name.endsWith('.filter.ts') ||
        name.endsWith('.decorator.ts') ||
        name.endsWith('.middleware.ts') ||
        name.includes('.config.') ||
        name.includes('.module.')
      ) {
        infraFiles.push(node.path);
      }
      // API layer
      else if (
        path.includes('/api/') ||
        path.includes('/routes/') ||
        path.includes('/controllers/') ||
        name.endsWith('.controller.ts') ||
        name.endsWith('.controller.js') ||
        name.includes('route') ||
        name.includes('controller') ||
        name.includes('handler') ||
        name.endsWith('.dto.ts') ||
        name.endsWith('.dto.js')
      ) {
        apiFiles.push(node.path);
      }
      // Service layer
      else if (
        path.includes('/service') ||
        path.includes('/business') ||
        path.includes('/logic') ||
        path.includes('/use-cases/') ||
        path.includes('/usecases/') ||
        name.endsWith('.service.ts') ||
        name.endsWith('.service.js') ||
        name.includes('service') ||
        name.includes('manager') ||
        name.includes('facade') ||
        name.includes('usecase')
      ) {
        serviceFiles.push(node.path);
      }
      // UI layer
      else if (
        path.includes('/ui/') ||
        path.includes('/components/') ||
        path.includes('/pages/') ||
        path.includes('/views/') ||
        path.includes('/screens/') ||
        path.includes('/templates/') ||
        node.extension === '.tsx' ||
        node.extension === '.jsx' ||
        node.extension === '.vue' ||
        node.extension === '.html'
      ) {
        uiFiles.push(node.path);
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.categorizeFiles(
          child,
          apiFiles,
          serviceFiles,
          dataFiles,
          uiFiles,
          infraFiles
        );
      }
    }
  }

  getModuleBoundaries(fileTree: FileNode): Map<string, string[]> {
    const modules = new Map<string, string[]>();
    this.identifyModules(fileTree, '', modules);
    return modules;
  }

  private identifyModules(
    node: FileNode,
    parentPath: string,
    modules: Map<string, string[]>
  ): void {
    if (node.type === 'directory') {
      const moduleFiles: string[] = [];
      this.collectFilesInModule(node, moduleFiles);

      if (moduleFiles.length > 0) {
        modules.set(node.name, moduleFiles);
      }
    }

    if (node.children) {
      for (const child of node.children) {
        this.identifyModules(child, parentPath + '/' + node.name, modules);
      }
    }
  }

  private collectFilesInModule(node: FileNode, files: string[]): void {
    if (node.type === 'file') {
      files.push(node.path);
    }

    if (node.children) {
      for (const child of node.children) {
        this.collectFilesInModule(child, files);
      }
    }
  }
}
