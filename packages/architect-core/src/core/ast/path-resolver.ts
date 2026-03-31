import fs from 'fs';
import path from 'path';

export class PathResolver {
  private projectRoot: string;
  private tsconfigPaths: Record<string, string[]> = {};
  private initialized = false;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  initialize(): void {
    if (this.initialized) return;
    try {
      this.loadTsConfig();
      // Em futuruos iteratives, carregar pyproject.toml e go.mod aliases
      this.initialized = true;
    } catch {
      // Falhas na leitura de config não devem quebrar o parser
    }
  }

  private loadTsConfig(): void {
    const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
    if (fs.existsSync(tsconfigPath)) {
      const content = fs.readFileSync(tsconfigPath, 'utf8');
      
      // Limpeza brutal de comentários JS/TS do JSON
      const cleanContent = content.replace(new RegExp('//.*$', 'gm'), '').replace(new RegExp('/\\\\*[\\\\s\\\\S]*?\\\\*/', 'g'), '');
      const parsed = JSON.parse(cleanContent);
      
      if (parsed?.compilerOptions?.paths) {
        this.tsconfigPaths = parsed.compilerOptions.paths;
      }
    }
  }

  /**
   * Resolve `importPath` baseando-se no dicionário de Aliases.
   * Ex: "@/" mapeia para "src/"
   */
  resolveAlias(importPath: string): string {
    this.initialize();

    for (const alias in this.tsconfigPaths) {
      // Ex: alias = "@/components/*", targets = ["src/components/*"]
      const cleanAlias = alias.replace('/*', '');
      
      if (importPath.startsWith(cleanAlias)) {
        const targets = this.tsconfigPaths[alias];
        if (targets && targets.length > 0) {
          const cleanTarget = targets[0].replace('/*', '');
          return importPath.replace(cleanAlias, cleanTarget);
        }
      }
    }

    return importPath;
  }
}
