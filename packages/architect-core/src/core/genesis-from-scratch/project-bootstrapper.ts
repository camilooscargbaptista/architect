/**
 * Project Bootstrapper
 *
 * Takes an ArchitectureBlueprint and generates a complete project
 * on disk — directories, source files, configs, rules, and README.
 *
 * File generation uses lightweight templates that produce real,
 * compilable code. Each template is parameterised by module name,
 * entity names, stack decisions, and architecture style.
 *
 * @since v10.0.0 — Phase 4.3
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type {
  ArchitectureBlueprint,
  BootstrapResult,
  ModuleFile,
  Entity,
  StackDecision,
  CrossCuttingConcern,
} from './types.js';

// ── Templates ────────────────────────────────────────────

interface TemplateContext {
  moduleName: string;
  pascalName: string;
  entities: Entity[];
  stack: StackDecision;
  projectName: string;
}

// ── Bootstrapper ─────────────────────────────────────────

export class ProjectBootstrapper {
  private filesCreated = 0;
  private directories: string[] = [];

  /**
   * Generate a complete project from an ArchitectureBlueprint.
   */
  bootstrap(blueprint: ArchitectureBlueprint, outputDir: string): BootstrapResult {
    this.filesCreated = 0;
    this.directories = [];

    const projectPath = join(outputDir, blueprint.projectName);
    this.ensureDir(projectPath);

    // 1. Package config
    this.writePackageJson(blueprint, projectPath);

    // 2. TypeScript config (if TS)
    if (blueprint.stack.language === 'typescript') {
      this.writeTsConfig(blueprint, projectPath);
    }

    // 3. Architect rules
    const rulesFile = this.writeRulesFile(blueprint, projectPath);

    // 4. Architect config
    const configFile = this.writeArchitectConfig(blueprint, projectPath);

    // 5. Environment template
    this.writeEnvFile(blueprint, projectPath);

    // 6. Git ignore
    this.writeGitIgnore(projectPath);

    // 7. Layer directories
    for (const layer of blueprint.layers) {
      this.ensureDir(join(projectPath, layer.directory));
    }

    // 8. Module source files
    for (const mod of blueprint.modules) {
      this.ensureDir(join(projectPath, mod.directory));
      const entities = blueprint.entities.filter(e =>
        mod.files.some(f => f.path.includes(this.toKebabCase(e.name))),
      );
      const ctx: TemplateContext = {
        moduleName: mod.name.split('-')[0]!,
        pascalName: this.toPascalCase(mod.name.split('-')[0]!),
        entities,
        stack: blueprint.stack,
        projectName: blueprint.projectName,
      };
      for (const file of mod.files) {
        this.writeSourceFile(file, ctx, projectPath);
      }
    }

    // 9. Cross-cutting concerns
    for (const concern of blueprint.crossCutting) {
      this.writeCrossCuttingFiles(concern, blueprint, projectPath);
    }

    // 10. Entry point
    this.writeEntryPoint(blueprint, projectPath);

    // 11. Test setup
    this.writeTestSetup(blueprint, projectPath);

    // 12. README
    const readmeGenerated = this.writeReadme(blueprint, projectPath);

    return {
      projectPath,
      filesCreated: this.filesCreated,
      directories: this.directories,
      blueprint,
      rulesFile,
      configFile,
      readmeGenerated,
    };
  }

  // ── Config files ───────────────────────────────────────

  private writePackageJson(bp: ArchitectureBlueprint, root: string): void {
    const deps: Record<string, string> = {};
    const devDeps: Record<string, string> = {};

    if (bp.stack.language === 'typescript') {
      devDeps['typescript'] = '^5.4.0';
      devDeps['@types/node'] = '^20.0.0';
      devDeps['tsx'] = '^4.0.0';

      if (bp.stack.framework === 'express') {
        deps['express'] = '^4.18.0';
        devDeps['@types/express'] = '^4.17.0';
      } else if (bp.stack.framework === 'fastify') {
        deps['fastify'] = '^4.26.0';
      } else if (bp.stack.framework === 'nestjs') {
        deps['@nestjs/core'] = '^10.0.0';
        deps['@nestjs/common'] = '^10.0.0';
        deps['@nestjs/platform-express'] = '^10.0.0';
      }

      if (bp.stack.orm === 'prisma') {
        deps['@prisma/client'] = '^5.0.0';
        devDeps['prisma'] = '^5.0.0';
      } else if (bp.stack.orm === 'drizzle') {
        deps['drizzle-orm'] = '^0.30.0';
        devDeps['drizzle-kit'] = '^0.20.0';
      }

      if (bp.stack.testFramework === 'jest') {
        devDeps['jest'] = '^29.0.0';
        devDeps['ts-jest'] = '^29.0.0';
        devDeps['@types/jest'] = '^29.0.0';
      } else if (bp.stack.testFramework === 'vitest') {
        devDeps['vitest'] = '^1.0.0';
      }

      for (const lib of bp.stack.libraries) {
        deps[lib.name] = 'latest';
      }
    }

    const scripts: Record<string, string> = {};
    if (bp.stack.language === 'typescript') {
      scripts['build'] = 'tsc';
      scripts['dev'] = 'tsx watch src/main.ts';
      scripts['start'] = 'node dist/main.js';
      scripts['test'] = bp.stack.testFramework === 'vitest' ? 'vitest' : 'jest';
      scripts['lint'] = 'tsc --noEmit';
    }

    const pkg = {
      name: bp.projectName,
      version: '0.1.0',
      description: bp.description,
      main: bp.stack.language === 'typescript' ? 'dist/main.js' : 'src/main.js',
      scripts,
      dependencies: deps,
      devDependencies: devDeps,
    };

    this.writeFile(join(root, 'package.json'), JSON.stringify(pkg, null, 2));
  }

  private writeTsConfig(_bp: ArchitectureBlueprint, root: string): void {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
        resolveJsonModule: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts'],
    };

    this.writeFile(join(root, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  }

  private writeRulesFile(bp: ArchitectureBlueprint, root: string): string {
    const lines: string[] = [
      `# Architecture Rules — ${bp.projectName}`,
      `# Generated by Architect Genesis (${bp.style})`,
      `# ${new Date().toISOString().split('T')[0]}`,
      '',
    ];

    for (const rule of bp.rules) {
      lines.push(`# ${rule.description}`);
      lines.push(rule.yaml);
      lines.push('');
    }

    const path = join(root, '.architect.rules.yml');
    this.writeFile(path, lines.join('\n'));
    return path;
  }

  private writeArchitectConfig(bp: ArchitectureBlueprint, root: string): string {
    const config = {
      projectName: bp.projectName,
      style: bp.style,
      scoringProfile: this.inferScoringProfile(bp),
      layers: bp.layers.map(l => ({
        name: l.name,
        directory: l.directory,
        allowedDependencies: l.allowedDependencies,
      })),
      boundaries: bp.boundaries.filter(b => !b.allowed).map(b => ({
        from: `${b.from}/*`,
        to: `${b.to}/*`,
      })),
    };

    const path = join(root, '.architect.json');
    this.writeFile(path, JSON.stringify(config, null, 2));
    return path;
  }

  private writeEnvFile(bp: ArchitectureBlueprint, root: string): void {
    const lines = [
      `# ${bp.projectName} — Environment Configuration`,
      '',
      '# Server',
      'PORT=3000',
      'NODE_ENV=development',
      '',
    ];

    if (bp.stack.database) {
      lines.push('# Database');
      if (bp.stack.database.includes('postgres')) {
        lines.push('DATABASE_URL=postgresql://user:password@localhost:5432/' + bp.projectName.replace(/-/g, '_'));
      } else if (bp.stack.database.includes('mongo')) {
        lines.push('DATABASE_URL=mongodb://localhost:27017/' + bp.projectName.replace(/-/g, '_'));
      } else {
        lines.push(`DATABASE_URL=<your-${bp.stack.database}-connection-string>`);
      }
      lines.push('');
    }

    const hasAuth = bp.crossCutting.some(c => c.type === 'auth');
    if (hasAuth) {
      lines.push('# Auth');
      lines.push('JWT_SECRET=change-me-in-production');
      lines.push('JWT_EXPIRES_IN=7d');
      lines.push('');
    }

    this.writeFile(join(root, '.env.example'), lines.join('\n'));
  }

  private writeGitIgnore(root: string): void {
    const content = [
      'node_modules/',
      'dist/',
      '.env',
      '.env.local',
      '*.log',
      '.architect/',
      'coverage/',
      '.DS_Store',
      '',
    ].join('\n');

    this.writeFile(join(root, '.gitignore'), content);
  }

  // ── Source files ───────────────────────────────────────

  private writeSourceFile(file: ModuleFile, ctx: TemplateContext, root: string): void {
    const content = this.renderTemplate(file, ctx);
    this.writeFile(join(root, file.path), content);
  }

  private renderTemplate(file: ModuleFile, ctx: TemplateContext): string {
    switch (file.template) {
      case 'controller': return this.templateController(ctx);
      case 'service': return this.templateService(ctx);
      case 'repository': return this.templateRepository(ctx);
      case 'entity': return this.templateEntity(ctx, file);
      case 'dto': return this.templateDTO(ctx, file);
      case 'types': return this.templateTypes(ctx);
      case 'index': return this.templateIndex(ctx, file);
      default: return this.templateGeneric(ctx, file);
    }
  }

  private templateController(ctx: TemplateContext): string {
    const { pascalName, moduleName, stack } = ctx;

    if (stack.framework === 'express') {
      return [
        `import { Router, Request, Response, NextFunction } from 'express';`,
        `import { ${pascalName}Service } from './${moduleName}.service.js';`,
        '',
        `const router = Router();`,
        `const service = new ${pascalName}Service();`,
        '',
        `/**`,
        ` * GET /${moduleName}`,
        ` */`,
        `router.get('/', async (_req: Request, res: Response, next: NextFunction) => {`,
        `  try {`,
        `    const items = await service.findAll();`,
        `    res.json(items);`,
        `  } catch (err) {`,
        `    next(err);`,
        `  }`,
        `});`,
        '',
        `/**`,
        ` * GET /${moduleName}/:id`,
        ` */`,
        `router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {`,
        `  try {`,
        `    const item = await service.findById(req.params['id']!);`,
        `    if (!item) { res.status(404).json({ error: 'Not found' }); return; }`,
        `    res.json(item);`,
        `  } catch (err) {`,
        `    next(err);`,
        `  }`,
        `});`,
        '',
        `/**`,
        ` * POST /${moduleName}`,
        ` */`,
        `router.post('/', async (req: Request, res: Response, next: NextFunction) => {`,
        `  try {`,
        `    const created = await service.create(req.body);`,
        `    res.status(201).json(created);`,
        `  } catch (err) {`,
        `    next(err);`,
        `  }`,
        `});`,
        '',
        `export { router as ${moduleName}Router };`,
        '',
      ].join('\n');
    }

    // Generic controller template
    return [
      `/**`,
      ` * ${pascalName} Controller`,
      ` */`,
      '',
      `export class ${pascalName}Controller {`,
      `  // TODO: implement route handlers`,
      `}`,
      '',
    ].join('\n');
  }

  private templateService(ctx: TemplateContext): string {
    const { pascalName, moduleName } = ctx;

    return [
      `/**`,
      ` * ${pascalName} Service`,
      ` *`,
      ` * Business logic for the ${moduleName} domain.`,
      ` */`,
      '',
      `export class ${pascalName}Service {`,
      `  async findAll(): Promise<unknown[]> {`,
      `    // TODO: implement`,
      `    return [];`,
      `  }`,
      '',
      `  async findById(id: string): Promise<unknown | null> {`,
      `    // TODO: implement`,
      `    return null;`,
      `  }`,
      '',
      `  async create(data: unknown): Promise<unknown> {`,
      `    // TODO: implement`,
      `    return data;`,
      `  }`,
      '',
      `  async update(id: string, data: unknown): Promise<unknown | null> {`,
      `    // TODO: implement`,
      `    return { id, ...data as object };`,
      `  }`,
      '',
      `  async delete(id: string): Promise<boolean> {`,
      `    // TODO: implement`,
      `    return false;`,
      `  }`,
      `}`,
      '',
    ].join('\n');
  }

  private templateRepository(ctx: TemplateContext): string {
    const { pascalName, moduleName, stack } = ctx;
    const orm = stack.orm ?? 'none';

    if (orm === 'prisma') {
      return [
        `/**`,
        ` * ${pascalName} Repository — Prisma`,
        ` */`,
        '',
        `// import { PrismaClient } from '@prisma/client';`,
        `// const prisma = new PrismaClient();`,
        '',
        `export class ${pascalName}Repository {`,
        `  async findAll(): Promise<unknown[]> {`,
        `    // return prisma.${moduleName}.findMany();`,
        `    return [];`,
        `  }`,
        '',
        `  async findById(id: string): Promise<unknown | null> {`,
        `    // return prisma.${moduleName}.findUnique({ where: { id } });`,
        `    return null;`,
        `  }`,
        '',
        `  async create(data: unknown): Promise<unknown> {`,
        `    // return prisma.${moduleName}.create({ data });`,
        `    return data;`,
        `  }`,
        '',
        `  async update(id: string, data: unknown): Promise<unknown> {`,
        `    // return prisma.${moduleName}.update({ where: { id }, data });`,
        `    return { id, ...data as object };`,
        `  }`,
        '',
        `  async delete(id: string): Promise<boolean> {`,
        `    // await prisma.${moduleName}.delete({ where: { id } });`,
        `    return true;`,
        `  }`,
        `}`,
        '',
      ].join('\n');
    }

    return [
      `/**`,
      ` * ${pascalName} Repository`,
      ` */`,
      '',
      `export class ${pascalName}Repository {`,
      `  private items: Map<string, unknown> = new Map();`,
      '',
      `  async findAll(): Promise<unknown[]> {`,
      `    return [...this.items.values()];`,
      `  }`,
      '',
      `  async findById(id: string): Promise<unknown | null> {`,
      `    return this.items.get(id) ?? null;`,
      `  }`,
      '',
      `  async create(data: unknown): Promise<unknown> {`,
      `    const id = crypto.randomUUID();`,
      `    const item = { id, ...data as object };`,
      `    this.items.set(id, item);`,
      `    return item;`,
      `  }`,
      '',
      `  async delete(id: string): Promise<boolean> {`,
      `    return this.items.delete(id);`,
      `  }`,
      `}`,
      '',
    ].join('\n');
  }

  private templateEntity(ctx: TemplateContext, file: ModuleFile): string {
    // Find the entity by name from the file path
    const entityName = this.extractEntityName(file.path);
    const entity = ctx.entities.find(e => this.toKebabCase(e.name) === entityName);

    if (!entity) {
      return [
        `/**`,
        ` * ${this.toPascalCase(entityName)} Entity`,
        ` */`,
        '',
        `export interface ${this.toPascalCase(entityName)} {`,
        `  id: string;`,
        `  createdAt: Date;`,
        `  updatedAt: Date;`,
        `}`,
        '',
      ].join('\n');
    }

    const pascal = this.toPascalCase(entity.name);
    const fieldLines = entity.fields.map(f => {
      const opt = f.required ? '' : '?';
      const desc = f.description ? ` /** ${f.description} */` : '';
      return `  ${f.name}${opt}: ${f.type};${desc}`;
    });

    return [
      `/**`,
      ` * ${pascal} Entity`,
      ` */`,
      '',
      `export interface ${pascal} {`,
      `  id: string;`,
      ...fieldLines,
      `  createdAt: Date;`,
      `  updatedAt: Date;`,
      `}`,
      '',
    ].join('\n');
  }

  private templateDTO(ctx: TemplateContext, file: ModuleFile): string {
    const entityName = this.extractEntityName(file.path);
    const entity = ctx.entities.find(e => this.toKebabCase(e.name) === entityName);
    const pascal = entity ? this.toPascalCase(entity.name) : this.toPascalCase(entityName);

    const createFields = entity
      ? entity.fields.filter(f => f.required).map(f => `  ${f.name}: ${f.type};`).join('\n')
      : `  // TODO: add fields`;

    return [
      `/**`,
      ` * ${pascal} — Data Transfer Objects`,
      ` */`,
      '',
      `export interface Create${pascal}DTO {`,
      createFields,
      `}`,
      '',
      `export interface Update${pascal}DTO {`,
      `  ${entity ? entity.fields.map(f => `${f.name}?: ${f.type}`).join(';\n  ') : '// TODO: add fields'};`,
      `}`,
      '',
      `export interface ${pascal}Response {`,
      `  id: string;`,
      entity ? entity.fields.map(f => `  ${f.name}: ${f.type};`).join('\n') : '  // TODO: add fields',
      `  createdAt: string;`,
      `}`,
      '',
    ].join('\n');
  }

  private templateTypes(ctx: TemplateContext): string {
    const { pascalName, moduleName } = ctx;

    return [
      `/**`,
      ` * ${pascalName} — Type Definitions`,
      ` */`,
      '',
      `export interface ${pascalName}Config {`,
      `  // Module-specific configuration`,
      `}`,
      '',
      `export type ${pascalName}Event =`,
      `  | { type: '${moduleName}.created'; payload: unknown }`,
      `  | { type: '${moduleName}.updated'; payload: unknown }`,
      `  | { type: '${moduleName}.deleted'; payload: { id: string } };`,
      '',
    ].join('\n');
  }

  private templateIndex(ctx: TemplateContext, _file: ModuleFile): string {
    return [
      `/**`,
      ` * ${ctx.pascalName} — Barrel Export`,
      ` */`,
      '',
      `// Re-export all public APIs from this module`,
      `// export * from './${ctx.moduleName}.service.js';`,
      `// export * from './${ctx.moduleName}.controller.js';`,
      '',
    ].join('\n');
  }

  private templateGeneric(_ctx: TemplateContext, file: ModuleFile): string {
    return [
      `/**`,
      ` * ${file.description}`,
      ` */`,
      '',
      `// TODO: implement`,
      '',
    ].join('\n');
  }

  // ── Cross-cutting files ────────────────────────────────

  private writeCrossCuttingFiles(concern: CrossCuttingConcern, bp: ArchitectureBlueprint, root: string): void {
    this.ensureDir(join(root, concern.directory));

    for (const file of concern.files) {
      const content = this.renderCrossCuttingTemplate(file.template, concern, bp);
      this.writeFile(join(root, file.path), content);
    }
  }

  private renderCrossCuttingTemplate(template: string, concern: CrossCuttingConcern, _bp: ArchitectureBlueprint): string {
    switch (template) {
      case 'auth-middleware':
        return [
          `/**`,
          ` * Authentication Middleware`,
          ` */`,
          '',
          `import { Request, Response, NextFunction } from 'express';`,
          '',
          `export function authMiddleware(req: Request, res: Response, next: NextFunction): void {`,
          `  const token = req.headers['authorization']?.replace('Bearer ', '');`,
          `  if (!token) {`,
          `    res.status(401).json({ error: 'Authentication required' });`,
          `    return;`,
          `  }`,
          '',
          `  try {`,
          `    // TODO: verify JWT token`,
          `    // const payload = jwt.verify(token, process.env['JWT_SECRET']!);`,
          `    // (req as any).user = payload;`,
          `    next();`,
          `  } catch {`,
          `    res.status(401).json({ error: 'Invalid token' });`,
          `  }`,
          `}`,
          '',
        ].join('\n');

      case 'auth-guard':
        return [
          `/**`,
          ` * Route Guard — Role-Based Access`,
          ` */`,
          '',
          `import { Request, Response, NextFunction } from 'express';`,
          '',
          `export function requireRole(...roles: string[]) {`,
          `  return (req: Request, res: Response, next: NextFunction): void => {`,
          `    // const user = (req as any).user;`,
          `    // if (!user || !roles.includes(user.role)) {`,
          `    //   res.status(403).json({ error: 'Insufficient permissions' });`,
          `    //   return;`,
          `    // }`,
          `    next();`,
          `  };`,
          `}`,
          '',
        ].join('\n');

      case 'app-error':
        return [
          `/**`,
          ` * Application Error Classes`,
          ` */`,
          '',
          `export class AppError extends Error {`,
          `  constructor(`,
          `    message: string,`,
          `    public statusCode: number = 500,`,
          `    public code: string = 'INTERNAL_ERROR',`,
          `  ) {`,
          `    super(message);`,
          `    this.name = 'AppError';`,
          `  }`,
          `}`,
          '',
          `export class NotFoundError extends AppError {`,
          `  constructor(resource: string, id?: string) {`,
          `    super(id ? \`\${resource} \${id} not found\` : \`\${resource} not found\`, 404, 'NOT_FOUND');`,
          `    this.name = 'NotFoundError';`,
          `  }`,
          `}`,
          '',
          `export class ValidationError extends AppError {`,
          `  constructor(message: string) {`,
          `    super(message, 400, 'VALIDATION_ERROR');`,
          `    this.name = 'ValidationError';`,
          `  }`,
          `}`,
          '',
          `export class UnauthorizedError extends AppError {`,
          `  constructor(message = 'Unauthorized') {`,
          `    super(message, 401, 'UNAUTHORIZED');`,
          `    this.name = 'UnauthorizedError';`,
          `  }`,
          `}`,
          '',
        ].join('\n');

      case 'error-handler':
        return [
          `/**`,
          ` * Global Error Handler Middleware`,
          ` */`,
          '',
          `import { Request, Response, NextFunction } from 'express';`,
          `import { AppError } from './app-error.js';`,
          '',
          `export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {`,
          `  if (err instanceof AppError) {`,
          `    res.status(err.statusCode).json({`,
          `      error: err.code,`,
          `      message: err.message,`,
          `    });`,
          `    return;`,
          `  }`,
          '',
          `  console.error('Unhandled error:', err);`,
          `  res.status(500).json({`,
          `    error: 'INTERNAL_ERROR',`,
          `    message: process.env['NODE_ENV'] === 'production' ? 'Internal server error' : err.message,`,
          `  });`,
          `}`,
          '',
        ].join('\n');

      case 'logger':
        return [
          `/**`,
          ` * Structured Logger`,
          ` */`,
          '',
          `export type LogLevel = 'debug' | 'info' | 'warn' | 'error';`,
          '',
          `const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };`,
          '',
          `class Logger {`,
          `  private level: LogLevel = (process.env['LOG_LEVEL'] as LogLevel) ?? 'info';`,
          '',
          `  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {`,
          `    if (LOG_LEVELS[level] < LOG_LEVELS[this.level]) return;`,
          `    const entry = {`,
          `      timestamp: new Date().toISOString(),`,
          `      level,`,
          `      message,`,
          `      ...meta,`,
          `    };`,
          `    console.log(JSON.stringify(entry));`,
          `  }`,
          '',
          `  debug(message: string, meta?: Record<string, unknown>): void { this.log('debug', message, meta); }`,
          `  info(message: string, meta?: Record<string, unknown>): void { this.log('info', message, meta); }`,
          `  warn(message: string, meta?: Record<string, unknown>): void { this.log('warn', message, meta); }`,
          `  error(message: string, meta?: Record<string, unknown>): void { this.log('error', message, meta); }`,
          `}`,
          '',
          `export const logger = new Logger();`,
          '',
        ].join('\n');

      case 'validation':
        return [
          `/**`,
          ` * Request Validation Middleware`,
          ` */`,
          '',
          `import { Request, Response, NextFunction } from 'express';`,
          `import { ZodSchema, ZodError } from 'zod';`,
          '',
          `export function validate(schema: ZodSchema) {`,
          `  return (req: Request, res: Response, next: NextFunction): void => {`,
          `    try {`,
          `      schema.parse(req.body);`,
          `      next();`,
          `    } catch (err) {`,
          `      if (err instanceof ZodError) {`,
          `        res.status(400).json({`,
          `          error: 'VALIDATION_ERROR',`,
          `          issues: err.issues,`,
          `        });`,
          `        return;`,
          `      }`,
          `      next(err);`,
          `    }`,
          `  };`,
          `}`,
          '',
        ].join('\n');

      default:
        return `// ${concern.name} — ${template}\n// TODO: implement\n`;
    }
  }

  // ── Entry point ────────────────────────────────────────

  private writeEntryPoint(bp: ArchitectureBlueprint, root: string): void {
    const ext = bp.stack.language === 'typescript' ? '.ts' : '.js';

    if (bp.stack.framework === 'express' && bp.stack.language === 'typescript') {
      const routerImports = bp.modules
        .filter(m => m.files.some(f => f.type === 'controller'))
        .map(m => {
          const name = m.name.split('-')[0]!;
          const controllerFile = m.files.find(f => f.type === 'controller');
          if (!controllerFile) return null;
          const importPath = './' + controllerFile.path.replace(/^src\//, '').replace(/\.ts$/, '.js');
          return { name, importPath };
        })
        .filter(Boolean) as Array<{ name: string; importPath: string }>;

      const lines = [
        `/**`,
        ` * ${bp.projectName} — Entry Point`,
        ` */`,
        '',
        `import express from 'express';`,
        `import { errorHandler } from './shared/errors/error-handler.js';`,
        `import { logger } from './shared/logger/logger.js';`,
      ];

      for (const r of routerImports) {
        lines.push(`import { ${r.name}Router } from '${r.importPath}';`);
      }

      lines.push('');
      lines.push(`const app = express();`);
      lines.push(`const PORT = parseInt(process.env['PORT'] ?? '3000', 10);`);
      lines.push('');
      lines.push(`// Middleware`);
      lines.push(`app.use(express.json());`);
      lines.push('');
      lines.push(`// Routes`);
      for (const r of routerImports) {
        lines.push(`app.use('/api/${r.name}', ${r.name}Router);`);
      }
      lines.push('');
      lines.push(`// Health check`);
      lines.push(`app.get('/health', (_req, res) => res.json({ status: 'ok' }));`);
      lines.push('');
      lines.push(`// Error handling`);
      lines.push(`app.use(errorHandler);`);
      lines.push('');
      lines.push(`app.listen(PORT, () => {`);
      lines.push(`  logger.info(\`${bp.projectName} listening on port \${PORT}\`);`);
      lines.push(`});`);
      lines.push('');
      lines.push(`export { app };`);
      lines.push('');

      this.writeFile(join(root, `src/main${ext}`), lines.join('\n'));
    } else {
      this.writeFile(join(root, `src/main${ext}`), [
        `/**`,
        ` * ${bp.projectName} — Entry Point`,
        ` */`,
        '',
        `console.log('${bp.projectName} starting...');`,
        '',
        `// TODO: initialize application`,
        '',
      ].join('\n'));
    }
  }

  // ── Test setup ─────────────────────────────────────────

  private writeTestSetup(bp: ArchitectureBlueprint, root: string): void {
    this.ensureDir(join(root, 'tests'));

    if (bp.stack.testFramework === 'jest') {
      // Jest config
      this.writeFile(join(root, 'jest.config.js'), [
        `/** @type {import('jest').Config} */`,
        `module.exports = {`,
        `  preset: 'ts-jest',`,
        `  testEnvironment: 'node',`,
        `  roots: ['<rootDir>/tests', '<rootDir>/src'],`,
        `  testMatch: ['**/*.test.ts'],`,
        `  moduleNameMapper: {`,
        `    '^(\\\\.{1,2}/.*)\\\\.js$': '$1',`,
        `  },`,
        `};`,
        '',
      ].join('\n'));
    }

    // Sample test
    const ext = bp.stack.language === 'typescript' ? '.ts' : '.js';
    this.writeFile(join(root, `tests/health.test${ext}`), [
      `/**`,
      ` * Health check test`,
      ` */`,
      '',
      `describe('${bp.projectName}', () => {`,
      `  it('should be configured correctly', () => {`,
      `    expect(true).toBe(true);`,
      `  });`,
      `});`,
      '',
    ].join('\n'));
  }

  // ── README ─────────────────────────────────────────────

  private writeReadme(bp: ArchitectureBlueprint, root: string): boolean {
    const lines = [
      `# ${bp.projectName}`,
      '',
      bp.description,
      '',
      `## Architecture`,
      '',
      `**Style:** ${bp.style}`,
      '',
      `> ${bp.styleRationale}`,
      '',
      `**Stack:** ${bp.stack.language} / ${bp.stack.framework} / ${bp.stack.database}`,
      '',
      `## Project Structure`,
      '',
      '```',
      `${bp.projectName}/`,
      `├── src/`,
    ];

    for (const layer of bp.layers) {
      lines.push(`│   ├── ${layer.directory.replace('src/', '')}/ — ${layer.responsibility}`);
    }

    lines.push(
      `│   ├── shared/ — Cross-cutting concerns`,
      `│   └── main.ts`,
      `├── tests/`,
      `├── .architect.json`,
      `├── .architect.rules.yml`,
      `├── package.json`,
      `└── tsconfig.json`,
      '```',
      '',
      `## Getting Started`,
      '',
      '```bash',
      `npm install`,
      `cp .env.example .env`,
      `# Edit .env with your database credentials`,
      `npm run dev`,
      '```',
      '',
      `## Architecture Rules`,
      '',
      `This project uses [Architect Genesis](https://github.com/camilooscargbaptista/architect) for architecture enforcement.`,
      '',
      '```bash',
      `# Score your architecture`,
      `architect score .`,
      '',
      `# Validate rules`,
      `architect check .`,
      '```',
      '',
      `---`,
      '',
      `*Generated by Architect Genesis v10.0.0*`,
      '',
    );

    this.writeFile(join(root, 'README.md'), lines.join('\n'));
    return true;
  }

  // ── Helpers ────────────────────────────────────────────

  private inferScoringProfile(bp: ArchitectureBlueprint): string {
    switch (bp.style) {
      case 'microservices': return 'microservices';
      case 'layered-monolith':
      case 'modular-monolith':
      case 'clean-architecture':
      case 'hexagonal': return 'backend-monolith';
      case 'event-driven': return 'data-pipeline';
      default: return 'default';
    }
  }

  private ensureDir(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
      this.directories.push(path);
    }
  }

  private writeFile(path: string, content: string): void {
    const dir = dirname(path);
    this.ensureDir(dir);
    writeFileSync(path, content, 'utf-8');
    this.filesCreated++;
  }

  private extractEntityName(filePath: string): string {
    const filename = filePath.split('/').pop() ?? '';
    return filename.replace(/\.(entity|dto)\.\w+$/, '');
  }

  private toKebabCase(s: string): string {
    return s.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
  }

  private toPascalCase(s: string): string {
    return s.replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_, c: string) => c.toUpperCase());
  }
}
