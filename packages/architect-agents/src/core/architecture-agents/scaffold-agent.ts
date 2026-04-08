/**
 * Scaffold Agent
 *
 * Generates project structure templates based on detected architecture patterns.
 * Can create new modules, layers, or entire project scaffolds following
 * the patterns discovered by the analyzer.
 *
 * Capabilities: scaffold
 *
 * @since v10.0.0 — Phase 2B
 */

import { resolve, join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { BaseArchitectureAgent } from './base-agent.js';
import type { AgentContext, AgentResult, AgentMetadata } from './types.js';

interface ScaffoldTemplate {
  path: string;
  content: string;
  description: string;
}

export class ScaffoldAgent extends BaseArchitectureAgent {
  readonly metadata: AgentMetadata = {
    id: 'scaffold-agent',
    name: 'Architecture Scaffold Agent',
    description: 'Generates module and layer scaffolds based on detected architecture patterns.',
    capabilities: ['scaffold'],
    version: '10.0.0',
  };

  private moduleName: string;

  constructor(moduleName: string = 'new-module') {
    super();
    this.moduleName = moduleName;
  }

  async preflight(context: AgentContext): Promise<string | null> {
    const absPath = resolve(context.projectPath);
    if (!existsSync(absPath)) {
      return `Project path does not exist: ${absPath}`;
    }
    return null;
  }

  protected async run(context: AgentContext): Promise<AgentResult> {
    const start = Date.now();
    const absPath = resolve(context.projectPath);

    const [
      { ConfigLoader },
      { ProjectScanner },
      { ArchitectureAnalyzer },
    ] = await Promise.all([
      import('@girardelli/architect-core/src/core/config.js'),
      import('@girardelli/architect-core/src/infrastructure/scanner.js'),
      import('@girardelli/architect-core/src/core/analyzer.js'),
    ]);

    // 1. Detect existing patterns
    const config = ConfigLoader.loadConfig(absPath);
    const scanner = new ProjectScanner(absPath, config);
    const projectInfo = scanner.scan();

    if (!projectInfo.fileTree) {
      return this.fail(start, 'Failed to scan project — no file tree');
    }

    const analyzer = new ArchitectureAnalyzer(absPath);
    await analyzer.initialize();
    const layers = analyzer.detectLayers(projectInfo.fileTree);

    // 2. Determine architecture style
    const layerNames = layers.map(l => l.name.toLowerCase());
    const hasControllers = layerNames.some(l => l.includes('controller') || l.includes('handler'));
    const hasServices = layerNames.some(l => l.includes('service') || l.includes('usecase'));
    const hasRepositories = layerNames.some(l => l.includes('repository') || l.includes('data'));
    const hasComponents = layerNames.some(l => l.includes('component') || l.includes('view'));

    // Detect language
    const lang = projectInfo.primaryLanguages[0] ?? 'typescript';
    const ext = this.getExtension(lang);

    // 3. Generate templates based on detected style
    const templates: ScaffoldTemplate[] = [];
    const modulePath = join(absPath, 'src', this.moduleName);

    if (hasControllers && hasServices) {
      // Backend layered architecture
      templates.push(
        this.makeTemplate(join(modulePath, `${this.moduleName}.controller${ext}`),
          this.controllerTemplate(this.moduleName, ext),
          `${this.moduleName} controller (HTTP handler)`),
        this.makeTemplate(join(modulePath, `${this.moduleName}.service${ext}`),
          this.serviceTemplate(this.moduleName, ext),
          `${this.moduleName} business logic service`),
      );
      if (hasRepositories) {
        templates.push(
          this.makeTemplate(join(modulePath, `${this.moduleName}.repository${ext}`),
            this.repositoryTemplate(this.moduleName, ext),
            `${this.moduleName} data access layer`),
        );
      }
      templates.push(
        this.makeTemplate(join(modulePath, `${this.moduleName}.types${ext}`),
          this.typesTemplate(this.moduleName, ext),
          `${this.moduleName} type definitions`),
        this.makeTemplate(join(modulePath, 'index' + ext),
          this.indexTemplate(this.moduleName, hasRepositories, ext),
          `${this.moduleName} barrel export`),
      );
    } else if (hasComponents) {
      // Frontend component architecture
      templates.push(
        this.makeTemplate(join(modulePath, `${this.capitalize(this.moduleName)}${ext}x`),
          this.componentTemplate(this.moduleName),
          `${this.moduleName} React component`),
        this.makeTemplate(join(modulePath, `use${this.capitalize(this.moduleName)}${ext}`),
          this.hookTemplate(this.moduleName),
          `${this.moduleName} custom hook`),
        this.makeTemplate(join(modulePath, 'index' + ext),
          this.frontendIndexTemplate(this.moduleName, ext),
          `${this.moduleName} barrel export`),
      );
    } else {
      // Generic module
      templates.push(
        this.makeTemplate(join(modulePath, `${this.moduleName}${ext}`),
          this.genericTemplate(this.moduleName, ext),
          `${this.moduleName} main module`),
        this.makeTemplate(join(modulePath, 'index' + ext),
          `export * from './${this.moduleName}.js';\n`,
          `${this.moduleName} barrel export`),
      );
    }

    // 4. Write files if autoMode
    let filesCreated = 0;
    if (context.autoMode) {
      for (const tpl of templates) {
        const dir = resolve(tpl.path, '..');
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        if (!existsSync(tpl.path)) {
          writeFileSync(tpl.path, tpl.content, 'utf8');
          filesCreated++;
          this.log(`Created: ${tpl.path}`);
        } else {
          this.log(`Skipped (exists): ${tpl.path}`);
        }
      }
    }

    return {
      agentId: this.metadata.id,
      success: true,
      summary: context.autoMode
        ? `Created ${filesCreated} files for module "${this.moduleName}"`
        : `Generated ${templates.length} scaffold templates for "${this.moduleName}". Run with --auto to write files.`,
      data: {
        moduleName: this.moduleName,
        detectedStyle: hasControllers ? 'layered-backend' : hasComponents ? 'frontend-component' : 'generic',
        detectedLayers: layerNames,
        language: lang,
        templates: templates.map(t => ({
          path: t.path.replace(absPath, '.'),
          description: t.description,
        })),
        filesCreated,
        autoMode: context.autoMode,
      },
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }

  private getExtension(lang: string): string {
    const map: Record<string, string> = {
      typescript: '.ts', javascript: '.js', python: '.py',
      go: '.go', java: '.java', rust: '.rs',
    };
    return map[lang] ?? '.ts';
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  }

  private makeTemplate(path: string, content: string, description: string): ScaffoldTemplate {
    return { path, content, description };
  }

  private controllerTemplate(name: string, ext: string): string {
    if (ext === '.ts' || ext === '.js') {
      return `import { ${this.capitalize(name)}Service } from './${name}.service.js';

export class ${this.capitalize(name)}Controller {
  constructor(private readonly service: ${this.capitalize(name)}Service) {}

  async getAll() {
    return this.service.findAll();
  }

  async getById(id: string) {
    return this.service.findById(id);
  }

  async create(data: unknown) {
    return this.service.create(data);
  }
}
`;
    }
    return `// ${name} controller\n`;
  }

  private serviceTemplate(name: string, ext: string): string {
    if (ext === '.ts' || ext === '.js') {
      return `import type { ${this.capitalize(name)} } from './${name}.types.js';

export class ${this.capitalize(name)}Service {
  async findAll(): Promise<${this.capitalize(name)}[]> {
    // TODO: implement
    return [];
  }

  async findById(id: string): Promise<${this.capitalize(name)} | null> {
    // TODO: implement
    return null;
  }

  async create(data: Partial<${this.capitalize(name)}>): Promise<${this.capitalize(name)}> {
    // TODO: implement
    throw new Error('Not implemented');
  }
}
`;
    }
    return `# ${name} service\n`;
  }

  private repositoryTemplate(name: string, ext: string): string {
    if (ext === '.ts' || ext === '.js') {
      return `import type { ${this.capitalize(name)} } from './${name}.types.js';

export class ${this.capitalize(name)}Repository {
  async findAll(): Promise<${this.capitalize(name)}[]> {
    // TODO: implement data access
    return [];
  }

  async findById(id: string): Promise<${this.capitalize(name)} | null> {
    // TODO: implement data access
    return null;
  }

  async save(entity: ${this.capitalize(name)}): Promise<${this.capitalize(name)}> {
    // TODO: implement data access
    return entity;
  }

  async delete(id: string): Promise<boolean> {
    // TODO: implement data access
    return false;
  }
}
`;
    }
    return `# ${name} repository\n`;
  }

  private typesTemplate(name: string, ext: string): string {
    if (ext === '.ts') {
      return `export interface ${this.capitalize(name)} {
  id: string;
  createdAt: string;
  updatedAt: string;
  // TODO: add domain fields
}

export interface Create${this.capitalize(name)}Dto {
  // TODO: define creation payload
}

export interface Update${this.capitalize(name)}Dto {
  // TODO: define update payload
}
`;
    }
    return `// ${name} types\n`;
  }

  private indexTemplate(name: string, hasRepo: boolean, _ext: string): string {
    const exports = [
      `export { ${this.capitalize(name)}Controller } from './${name}.controller.js';`,
      `export { ${this.capitalize(name)}Service } from './${name}.service.js';`,
    ];
    if (hasRepo) {
      exports.push(`export { ${this.capitalize(name)}Repository } from './${name}.repository.js';`);
    }
    exports.push(`export type * from './${name}.types.js';`);
    return exports.join('\n') + '\n';
  }

  private componentTemplate(name: string): string {
    const comp = this.capitalize(name);
    return `import { use${comp} } from './use${comp}.js';

interface ${comp}Props {
  // TODO: define props
}

export function ${comp}(_props: ${comp}Props) {
  const { data, loading } = use${comp}();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>${comp}</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
`;
  }

  private hookTemplate(name: string): string {
    const comp = this.capitalize(name);
    return `import { useState, useEffect } from 'react';

export function use${comp}() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: fetch data
    setData(null);
    setLoading(false);
  }, []);

  return { data, loading, setData };
}
`;
  }

  private frontendIndexTemplate(name: string, _ext: string): string {
    const comp = this.capitalize(name);
    return `export { ${comp} } from './${comp}.jsx';\nexport { use${comp} } from './use${comp}.js';\n`;
  }

  private genericTemplate(name: string, ext: string): string {
    if (ext === '.ts' || ext === '.js') {
      return `/**\n * ${this.capitalize(name)} module\n *\n * TODO: implement\n */\n\nexport class ${this.capitalize(name)} {\n  // TODO: implement\n}\n`;
    }
    return `# ${name} module\n`;
  }

  private fail(start: number, message: string): AgentResult {
    return {
      agentId: this.metadata.id,
      success: false,
      summary: message,
      data: {},
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}
