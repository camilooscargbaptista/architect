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

      if (
        path.includes('/api/') ||
        path.includes('/routes/') ||
        path.includes('/controllers/') ||
        name.includes('route') ||
        name.includes('controller') ||
        name.includes('handler')
      ) {
        apiFiles.push(node.path);
      } else if (
        path.includes('/service') ||
        path.includes('/business') ||
        path.includes('/logic') ||
        name.includes('service') ||
        name.includes('manager') ||
        name.includes('facade')
      ) {
        serviceFiles.push(node.path);
      } else if (
        path.includes('/data/') ||
        path.includes('/db/') ||
        path.includes('/database/') ||
        path.includes('/models/') ||
        path.includes('/schema/') ||
        name.includes('repository') ||
        name.includes('dao') ||
        name.includes('mapper')
      ) {
        dataFiles.push(node.path);
      } else if (
        path.includes('/ui/') ||
        path.includes('/components/') ||
        path.includes('/pages/') ||
        path.includes('/views/') ||
        path.includes('/screens/') ||
        node.extension === '.tsx' ||
        node.extension === '.jsx'
      ) {
        uiFiles.push(node.path);
      } else if (
        path.includes('/config/') ||
        path.includes('/infra/') ||
        path.includes('/setup/') ||
        path.includes('docker') ||
        path.includes('kubernetes')
      ) {
        infraFiles.push(node.path);
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
