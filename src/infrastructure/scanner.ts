import { globSync } from 'glob';
import { readFileSync, lstatSync, existsSync } from 'fs';
import { join, relative, extname, resolve } from 'path';
import { FileNode, ProjectInfo, WorkspaceInfo } from '../core/types/infrastructure.js';
import { ArchitectConfig } from '../core/types/core.js';
import { logger } from './logger.js';

export class ProjectScanner {
  private projectPath: string;
  private config: ArchitectConfig;
  private frameworks: Set<string> = new Set();

  constructor(projectPath: string, config: ArchitectConfig) {
    this.projectPath = projectPath;
    this.config = config;
  }

  scan(): ProjectInfo {
    const files = this.scanDirectory();
    const fileTree = this.buildFileTree(files);

    // Detect workspaces from root package.json
    const workspaces = this.detectWorkspaces();

    // Detect frameworks ONLY from root + workspace package.json files (never from node_modules)
    const workspacePkgJsonPaths = [
      join(this.projectPath, 'package.json'),
      ...workspaces.map(ws => join(ws.path, 'package.json')),
    ].filter(p => existsSync(p));

    const frameworks = this.detectFrameworks(workspacePkgJsonPaths);
    const languages = this.detectLanguages(files);
    const totalLines = this.countTotalLines(files);
    const projectName = this.resolveProjectName(workspacePkgJsonPaths);

    return {
      path: this.projectPath,
      name: projectName,
      frameworks: Array.from(frameworks),
      totalFiles: files.length,
      totalLines,
      primaryLanguages: languages,
      fileTree,
      workspaces: workspaces.length > 0 ? workspaces : undefined,
    };
  }

  /**
   * Detect npm/yarn/pnpm workspaces from root package.json.
   * Reads the "workspaces" field and resolves each workspace to its package.json.
   */
  private detectWorkspaces(): WorkspaceInfo[] {
    const rootPkgPath = join(this.projectPath, 'package.json');
    if (!existsSync(rootPkgPath)) return [];

    try {
      const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
      let workspaceGlobs: string[] = [];

      if (Array.isArray(rootPkg.workspaces)) {
        workspaceGlobs = rootPkg.workspaces;
      } else if (rootPkg.workspaces?.packages && Array.isArray(rootPkg.workspaces.packages)) {
        workspaceGlobs = rootPkg.workspaces.packages;
      }

      if (workspaceGlobs.length === 0) return [];

      const workspaces: WorkspaceInfo[] = [];

      for (const pattern of workspaceGlobs) {
        // Resolve glob patterns like "packages/*"
        const dirs = globSync(pattern, {
          cwd: this.projectPath,
          absolute: true,
        });

        for (const dir of dirs) {
          const pkgPath = join(dir, 'package.json');
          if (!existsSync(pkgPath)) continue;

          try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            workspaces.push({
              name: pkg.name || relative(this.projectPath, dir),
              path: dir,
              relativePath: relative(this.projectPath, dir),
              description: pkg.description || '',
              version: pkg.version || '0.0.0',
              dependencies: pkg.dependencies || {},
              devDependencies: pkg.devDependencies || {},
              bin: pkg.bin || undefined,
              main: pkg.main || undefined,
            });
          } catch (error) {
            logger.debug('Skipping unparseable package.json in workspace', { pkgPath, error });
          }
        }
      }

      return workspaces;
    } catch (error) {
      logger.debug('Failed to parse root package.json for workspaces', { error });
      return [];
    }
  }

  /**
   * Resolve project name from nearest package.json or directory name
   */
  private resolveProjectName(packageJsonPaths: string[]): string {
    for (const pkgPath of packageJsonPaths) {
      try {
        const content = readFileSync(pkgPath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed.name) {
          return parsed.name;
        }
      } catch (error) {
        logger.debug('Skipping unparseable package.json while resolving project name', { pkgPath, error });
      }
    }
    return this.projectPath.split('/').pop() || 'project';
  }

  private scanDirectory(): string[] {
    const ignorePatterns = this.config.ignore || [];

    const files = globSync('**/*', {
      cwd: this.projectPath,
      ignore: ignorePatterns,
      absolute: true,
      nodir: true,
    });

    return files.filter(
      (f) =>
        !lstatSync(f).isDirectory() && this.isSourceFile(f)
    );
  }

  private isSourceFile(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase();
    const sourceExtensions = [
      '.js',
      '.ts',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.go',
      '.rb',
      '.php',
      '.cs',
      '.cpp',
      '.c',
      '.h',
      '.rs',
      '.kt',
      '.scala',
      '.groovy',
      '.sql',
      '.graphql',
      '.json',
      '.yaml',
      '.yml',
      '.xml',
    ];
    return sourceExtensions.includes(ext);
  }

  private buildFileTree(files: string[]): FileNode {
    const root: FileNode = {
      path: this.projectPath,
      name: this.projectPath.split('/').pop() || 'root',
      type: 'directory',
    };

    for (const file of files) {
      const relativePath = relative(this.projectPath, file);
      const parts = relativePath.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        let child = (current.children || []).find((c) => c.name === part);
        if (!child) {
          child = {
            path: join(current.path, part),
            name: part,
            type: isFile ? 'file' : 'directory',
            extension: isFile ? extname(part) : undefined,
          };

          if (isFile) {
            child.lines = this.countLines(file);
            child.language = this.detectLanguage(file);
          }

          if (!current.children) current.children = [];
          current.children.push(child);
        }

        current = child;
      }
    }

    return root;
  }

  /**
   * Detect frameworks ONLY from specified package.json files.
   * Never reads package.json from node_modules.
   * No string-matching fallback — only structured dependency key detection.
   */
  private detectFrameworks(packageJsonPaths: string[]): Set<string> {
    const frameworks = new Set<string>();

    for (const file of packageJsonPaths) {
      if (!file.endsWith('package.json')) continue;

      // Safety: skip any path that includes node_modules
      if (file.includes('node_modules')) continue;

      try {
        const content = readFileSync(file, 'utf-8');
        const parsed = JSON.parse(content);
        const allDeps = {
          ...parsed.dependencies,
          ...parsed.devDependencies,
        };

        // Detect from actual dependency keys — no string fallback
        if (allDeps['@nestjs/core'] || allDeps['@nestjs/common']) frameworks.add('NestJS');
        if (allDeps['react'] || allDeps['react-dom']) frameworks.add('React');
        if (allDeps['@angular/core']) frameworks.add('Angular');
        if (allDeps['vue'] || allDeps['@vue/core']) frameworks.add('Vue.js');
        if (allDeps['express']) frameworks.add('Express.js');
        if (allDeps['next']) frameworks.add('Next.js');
        if (allDeps['fastify']) frameworks.add('Fastify');
        if (allDeps['typeorm']) frameworks.add('TypeORM');
        if (allDeps['prisma'] || allDeps['@prisma/client']) frameworks.add('Prisma');
        if (allDeps['sequelize']) frameworks.add('Sequelize');
        if (allDeps['mongoose']) frameworks.add('Mongoose');
        if (allDeps['@modelcontextprotocol/sdk']) frameworks.add('MCP SDK');
        if (allDeps['probot']) frameworks.add('Probot');
        if (allDeps['hono']) frameworks.add('Hono');
      } catch (error) {
        logger.debug('Skipping unparseable package.json during framework detection', { file, error });
      }
    }

    // Check for pom.xml only at project root
    const pomPath = join(this.projectPath, 'pom.xml');
    if (existsSync(pomPath)) {
      try {
        const content = readFileSync(pomPath, 'utf-8');
        if (content.includes('spring-boot')) frameworks.add('Spring Boot');
        if (content.includes('spring') && !content.includes('spring-boot')) frameworks.add('Spring');
      } catch (error) {
        logger.debug('Error reading pom.xml', { error });
      }
    }

    // Check for requirements.txt only at project root
    const reqPath = join(this.projectPath, 'requirements.txt');
    if (existsSync(reqPath)) {
      try {
        const content = readFileSync(reqPath, 'utf-8');
        if (content.includes('django')) frameworks.add('Django');
        if (content.includes('flask')) frameworks.add('Flask');
        if (content.includes('fastapi')) frameworks.add('FastAPI');
      } catch (error) {
        logger.debug('Error reading requirements.txt', { error });
      }
    }

    // Check for Gemfile only at project root
    const gemPath = join(this.projectPath, 'Gemfile');
    if (existsSync(gemPath)) {
      try {
        const content = readFileSync(gemPath, 'utf-8');
        if (content.includes('rails')) frameworks.add('Ruby on Rails');
      } catch (error) {
        logger.debug('Error reading Gemfile', { error });
      }
    }

    // Check for go.mod only at project root
    if (existsSync(join(this.projectPath, 'go.mod'))) {
      frameworks.add('Go');
    }

    return frameworks;
  }

  private detectLanguages(files: string[]): string[] {
    const languages = new Set<string>();

    for (const file of files) {
      const lang = this.detectLanguage(file);
      if (lang && lang !== 'Unknown') languages.add(lang);
    }

    return Array.from(languages);
  }

  private detectLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();

    const languageMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.cs': 'C#',
      '.cpp': 'C++',
      '.c': 'C',
      '.rs': 'Rust',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.sql': 'SQL',
      '.graphql': 'GraphQL',
    };

    return languageMap[ext] || 'Unknown';
  }

  private countLines(filePath: string): number {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  private countTotalLines(files: string[]): number {
    return files.reduce((total, file) => total + this.countLines(file), 0);
  }
}
