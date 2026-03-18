import { globSync } from 'glob';
import { readFileSync, lstatSync } from 'fs';
import { join, relative, extname } from 'path';
import { FileNode, ProjectInfo, ArchitectConfig } from './types.js';

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

    // Detect frameworks from scanned files AND parent package.json
    const parentPackageJsons = this.findParentPackageJsons();
    const allFilesForDetection = [...files, ...parentPackageJsons];
    const frameworks = this.detectFrameworks(allFilesForDetection);

    const languages = this.detectLanguages(files);
    const totalLines = this.countTotalLines(files);
    const projectName = this.resolveProjectName(parentPackageJsons);

    return {
      path: this.projectPath,
      name: projectName,
      frameworks: Array.from(frameworks),
      totalFiles: files.length,
      totalLines,
      primaryLanguages: languages,
      fileTree,
    };
  }

  /**
   * Walk up directory tree to find package.json files for project name and framework detection
   */
  private findParentPackageJsons(): string[] {
    const found: string[] = [];
    let dir = this.projectPath;
    const root = '/';
    let depth = 0;

    while (dir !== root && depth < 5) {
      const pkgPath = join(dir, 'package.json');
      try {
        readFileSync(pkgPath, 'utf-8');
        found.push(pkgPath);
      } catch {
        // no package.json here
      }
      dir = join(dir, '..');
      depth++;
    }

    return found;
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
      } catch {
        // skip
      }
    }
    return this.projectPath.split('/').pop() || 'project';
  }

  private scanDirectory(): string[] {
    const ignorePatterns = this.config.ignore || [];
    const negatedPatterns = ignorePatterns.map((p) => `!**/${p}/**`);

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

  private detectFrameworks(files: string[]): Set<string> {
    const frameworks = new Set<string>();

    for (const file of files) {
      if (file.endsWith('package.json')) {
        try {
          const content = readFileSync(file, 'utf-8');
          const parsed = JSON.parse(content);
          const allDeps = {
            ...parsed.dependencies,
            ...parsed.devDependencies,
          };

          // Detect from actual dependency keys
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
        } catch {
          // Fallback: simple string matching
          try {
            const content = readFileSync(file, 'utf-8');
            if (content.includes('@nestjs')) frameworks.add('NestJS');
            if (content.includes('react')) frameworks.add('React');
            if (content.includes('angular')) frameworks.add('Angular');
            if (content.includes('vue')) frameworks.add('Vue.js');
            if (content.includes('express')) frameworks.add('Express.js');
            if (content.includes('next')) frameworks.add('Next.js');
          } catch {
            // skip
          }
        }
      }

      if (file.includes('pom.xml')) {
        try {
          const content = readFileSync(file, 'utf-8');
          if (content.includes('spring-boot')) frameworks.add('Spring Boot');
          if (content.includes('spring')) frameworks.add('Spring');
        } catch {
          // skip
        }
      }

      if (file.includes('requirements.txt')) {
        try {
          const content = readFileSync(file, 'utf-8');
          if (content.includes('django')) frameworks.add('Django');
          if (content.includes('flask')) frameworks.add('Flask');
          if (content.includes('fastapi')) frameworks.add('FastAPI');
        } catch {
          // skip
        }
      }

      if (file.includes('Gemfile')) {
        try {
          const content = readFileSync(file, 'utf-8');
          if (content.includes('rails')) frameworks.add('Ruby on Rails');
        } catch {
          // skip
        }
      }

      if (file.includes('go.mod')) {
        frameworks.add('Go');
      }
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
