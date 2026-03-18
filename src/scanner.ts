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
    const frameworks = this.detectFrameworks(files);

    const languages = this.detectLanguages(files);
    const totalLines = this.countTotalLines(files);

    return {
      path: this.projectPath,
      name: this.projectPath.split('/').pop() || 'project',
      frameworks: Array.from(frameworks),
      totalFiles: files.length,
      totalLines,
      primaryLanguages: languages,
      fileTree,
    };
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
      if (file.includes('package.json')) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('react')) frameworks.add('React');
        if (content.includes('angular')) frameworks.add('Angular');
        if (content.includes('vue')) frameworks.add('Vue.js');
        if (content.includes('express')) frameworks.add('Express.js');
        if (content.includes('nestjs')) frameworks.add('NestJS');
        if (content.includes('next')) frameworks.add('Next.js');
      }

      if (file.includes('pom.xml')) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('spring-boot')) frameworks.add('Spring Boot');
        if (content.includes('spring')) frameworks.add('Spring');
      }

      if (file.includes('requirements.txt')) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('django')) frameworks.add('Django');
        if (content.includes('flask')) frameworks.add('Flask');
        if (content.includes('fastapi')) frameworks.add('FastAPI');
      }

      if (file.includes('Gemfile')) {
        const content = readFileSync(file, 'utf-8');
        if (content.includes('rails')) frameworks.add('Ruby on Rails');
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
      if (lang) languages.add(lang);
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
