import { readFileSync, existsSync } from 'fs';
import { extname, relative, dirname, resolve, join } from 'path';
import { DependencyEdge, Layer, FileNode } from './types.js';

export class ArchitectureAnalyzer {
  private projectPath: string;
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private fileExtensions: Map<string, string> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  analyzeDependencies(fileTree: FileNode): DependencyEdge[] {
    this.getProjectPackageNames(fileTree);
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
      const rawImports = this.parseImports(node.path);
      const resolvedImports = rawImports.map(imp => this.resolveImportPath(node.path, imp));
      this.dependencyGraph.set(node.path, new Set(resolvedImports));
    }

    if (node.children) {
      for (const child of node.children) {
        this.buildDependencyGraph(child);
      }
    }
  }

  /**
   * Resolve a relative import path to an absolute file path.
   * Tries common extensions (.ts, .tsx, .js, .jsx, /index.ts, etc.)
   */
  private resolveImportPath(fromFile: string, importPath: string): string {
    // Non-relative imports (Python module names, etc.) — return as-is
    if (!importPath.startsWith('.')) return importPath;

    const dir = dirname(fromFile);
    const base = resolve(dir, importPath);

    // Common extensions to try
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.dart', '.go', '.java', '.rb'];
    const indexFiles = extensions.map(ext => join(base, `index${ext}`));

    // Try exact match first
    if (existsSync(base) && !existsSync(base + '/')) return base;

    // Try with extensions
    for (const ext of extensions) {
      const candidate = base + ext;
      if (existsSync(candidate)) return candidate;
    }

    // Try as directory with index file
    for (const indexFile of indexFiles) {
      if (existsSync(indexFile)) return indexFile;
    }

    // Fallback: return the resolved path even if file not found
    return base;
  }

  /**
   * Known Python standard library modules (partial list of most common ones)
   */
  private static readonly PYTHON_STDLIB: Set<string> = new Set([
    'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio', 'asyncore',
    'atexit', 'base64', 'bdb', 'binascii', 'binhex', 'bisect', 'builtins',
    'bz2', 'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd', 'code',
    'codecs', 'codeop', 'collections', 'colorsys', 'compileall', 'concurrent',
    'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg', 'cProfile',
    'crypt', 'csv', 'ctypes', 'curses', 'dataclasses', 'datetime', 'dbm',
    'decimal', 'difflib', 'dis', 'distutils', 'doctest', 'email', 'encodings',
    'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp', 'fileinput', 'fnmatch',
    'fractions', 'ftplib', 'functools', 'gc', 'getopt', 'getpass', 'gettext',
    'glob', 'grp', 'gzip', 'hashlib', 'heapq', 'hmac', 'html', 'http',
    'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib', 'inspect', 'io',
    'ipaddress', 'itertools', 'json', 'keyword', 'lib2to3', 'linecache',
    'locale', 'logging', 'lzma', 'mailbox', 'mailcap', 'marshal', 'math',
    'mimetypes', 'mmap', 'modulefinder', 'multiprocessing', 'netrc', 'nis',
    'nntplib', 'numbers', 'operator', 'optparse', 'os', 'ossaudiodev',
    'pathlib', 'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform',
    'plistlib', 'poplib', 'posix', 'posixpath', 'pprint', 'profile', 'pstats',
    'pty', 'pwd', 'py_compile', 'pyclbr', 'pydoc', 'queue', 'quopri',
    'random', 're', 'readline', 'reprlib', 'resource', 'rlcompleter', 'runpy',
    'sched', 'secrets', 'select', 'selectors', 'shelve', 'shlex', 'shutil',
    'signal', 'site', 'smtpd', 'smtplib', 'sndhdr', 'socket', 'socketserver',
    'sqlite3', 'ssl', 'stat', 'statistics', 'string', 'stringprep', 'struct',
    'subprocess', 'sunau', 'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny',
    'tarfile', 'telnetlib', 'tempfile', 'termios', 'test', 'textwrap', 'threading',
    'time', 'timeit', 'tkinter', 'token', 'tokenize', 'tomllib', 'trace',
    'traceback', 'tracemalloc', 'tty', 'turtle', 'turtledemo', 'types',
    'typing', 'unicodedata', 'unittest', 'urllib', 'uu', 'uuid', 'venv',
    'warnings', 'wave', 'weakref', 'webbrowser', 'winreg', 'winsound',
    'wsgiref', 'xdrlib', 'xml', 'xmlrpc', 'zipapp', 'zipfile', 'zipimport',
    'zlib', '_thread',
  ]);

  /**
   * Resolve the project's root Python package name from directory structure.
   * E.g., for projectPath="/foo/src", if there's a "deepguard/" dir, the package is "deepguard".
   */
  private projectPackageNames: Set<string> | null = null;

  private getProjectPackageNames(fileTree: FileNode): Set<string> {
    if (this.projectPackageNames) return this.projectPackageNames;
    this.projectPackageNames = new Set<string>();
    if (fileTree.children) {
      for (const child of fileTree.children) {
        if (child.type === 'directory') {
          this.projectPackageNames.add(child.name);
        }
      }
    }
    return this.projectPackageNames;
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
          const importPath = match[1];
          // Only count relative imports (./  ../) as internal dependencies
          if (importPath.startsWith('.')) {
            imports.push(importPath);
          }
        }
      } else if (ext === '.py') {
        // Parse "from X import Y" — capture X (the module source)
        const fromImportRegex = /^from\s+([\w.]+)\s+import\b/gm;
        let match;
        while ((match = fromImportRegex.exec(content)) !== null) {
          const moduleName = match[1];
          if (this.isInternalPythonImport(moduleName)) {
            imports.push(moduleName);
          }
        }
        // Parse "import X" — capture X
        const directImportRegex = /^import\s+([\w.]+)(?:\s+as\s+\w+)?$/gm;
        while ((match = directImportRegex.exec(content)) !== null) {
          const moduleName = match[1];
          if (this.isInternalPythonImport(moduleName)) {
            imports.push(moduleName);
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

  /**
   * Check if a Python import is internal to the project.
   * Internal imports: relative (starts with .) or matches project package names.
   * External imports: stdlib, third-party (numpy, cv2, PIL, etc.)
   */
  private isInternalPythonImport(moduleName: string): boolean {
    // Relative imports are always internal
    if (moduleName.startsWith('.')) return true;

    // Get the top-level module name (e.g., "deepguard" from "deepguard.cli")
    const topLevel = moduleName.split('.')[0];

    // Check against Python stdlib
    if (ArchitectureAnalyzer.PYTHON_STDLIB.has(topLevel)) return false;

    // Check if it matches a known project package directory
    if (this.projectPackageNames && this.projectPackageNames.has(topLevel)) return true;

    // Default: treat unknown imports as external (conservative approach)
    return false;
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
