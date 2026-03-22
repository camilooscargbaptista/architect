import { readFileSync, existsSync } from 'fs';
import { join, basename, dirname } from 'path';
import { AnalysisReport, ProjectSummary, FileNode } from './types.js';

/**
 * ProjectSummarizer — infers what a project does from its metadata,
 * structure, README, package.json, and file naming conventions.
 */
export class ProjectSummarizer {
  summarize(projectPath: string, report: AnalysisReport): ProjectSummary {
    const packageInfo = this.readPackageJson(projectPath);
    const readmeContent = this.readReadme(projectPath);
    const modules = this.inferModules(report);
    const entryPoints = this.findEntryPoints(report);
    const keywords = this.extractKeywords(packageInfo, readmeContent, modules, report);
    const techStack = this.buildTechStack(report, packageInfo);
    const description = this.buildDescription(packageInfo, readmeContent, report);
    const purpose = this.inferPurpose(keywords, modules, report);

    return {
      description,
      purpose,
      modules,
      techStack,
      entryPoints,
      keywords,
    };
  }

  // ── Package.json ──

  private readPackageJson(projectPath: string): Record<string, unknown> {
    const candidates = [
      join(projectPath, 'package.json'),
      join(projectPath, 'pyproject.toml'),
      join(projectPath, 'pubspec.yaml'),
      join(projectPath, 'Cargo.toml'),
      join(projectPath, 'pom.xml'),
      join(projectPath, 'build.gradle'),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        try {
          if (candidate.endsWith('.json')) {
            return JSON.parse(readFileSync(candidate, 'utf-8'));
          }
          // For non-JSON, return raw content as 'raw' field
          return { raw: readFileSync(candidate, 'utf-8'), type: basename(candidate) };
        } catch {
          // ignore
        }
      }
    }
    return {};
  }

  private readReadme(projectPath: string): string {
    const candidates = ['README.md', 'readme.md', 'README.txt', 'README', 'README.rst'];
    for (const name of candidates) {
      const path = join(projectPath, name);
      if (existsSync(path)) {
        try {
          // Read first 3000 chars — enough for description, skip excessive content
          return readFileSync(path, 'utf-8').slice(0, 3000);
        } catch {
          // ignore
        }
      }
    }
    return '';
  }

  // ── Module Inference ──

  private inferModules(report: AnalysisReport): ProjectSummary['modules'] {
    const modules: Map<string, { files: Set<string>; hints: Set<string> }> = new Map();

    for (const node of report.dependencyGraph.nodes) {
      const parts = node.split('/');
      // Skip root-level files
      if (parts.length < 2) continue;

      // Get the module directory (2nd level, or 1st level for flat projects)
      let moduleName: string;
      const firstDir = parts[0];

      // Common source directories — go one level deeper
      if (['src', 'lib', 'app', 'packages', 'modules', 'features', 'apps'].includes(firstDir)) {
        moduleName = parts.length > 2 ? parts[1] : firstDir;
      } else if (firstDir === 'tests' || firstDir === 'test' || firstDir === '__tests__') {
        continue; // Skip test directories for module inference
      } else {
        moduleName = firstDir;
      }

      if (!modules.has(moduleName)) {
        modules.set(moduleName, { files: new Set(), hints: new Set() });
      }
      const mod = modules.get(moduleName)!;
      mod.files.add(node);

      // Extract hints from filenames
      const filename = basename(node).replace(/\.(ts|js|py|dart|go|java|rb|php|cs|tsx|jsx)$/, '');
      if (filename !== 'index' && filename !== 'main' && filename !== '__init__') {
        mod.hints.add(filename.toLowerCase());
      }
    }

    return [...modules.entries()]
      .filter(([, data]) => data.files.size > 0)
      .sort((a, b) => b[1].files.size - a[1].files.size)
      .slice(0, 15) // Top 15 modules
      .map(([name, data]) => ({
        name,
        files: data.files.size,
        description: this.describeModule(name, data.hints),
      }));
  }

  private describeModule(name: string, hints: Set<string>): string {
    const n = name.toLowerCase();
    const h = [...hints].join(' ');

    // Known module patterns
    const patterns: [RegExp, string][] = [
      [/auth/, 'Autenticação e autorização'],
      [/user/, 'Gestão de usuários'],
      [/payment|billing|charge|invoice/, 'Pagamentos e faturamento'],
      [/order|cart|checkout/, 'Pedidos e checkout'],
      [/product|catalog|item/, 'Catálogo de produtos'],
      [/notif/, 'Sistema de notificações'],
      [/email|mail|smtp/, 'Envio de emails'],
      [/report|analytics|dashboard/, 'Relatórios e analytics'],
      [/config|setting/, 'Configuração do sistema'],
      [/util|helper|common|shared/, 'Utilitários compartilhados'],
      [/middleware|interceptor|guard|pipe/, 'Middleware e interceptors'],
      [/database|db|migration|seed/, 'Banco de dados e migrations'],
      [/api|controller|route|endpoint/, 'API endpoints'],
      [/service|business|domain/, 'Lógica de negócio'],
      [/model|entity|schema/, 'Modelos de dados'],
      [/test|spec|fixture/, 'Testes'],
      [/validator|validation|sanitiz/, 'Validação de dados'],
      [/security|crypto|encrypt/, 'Segurança e criptografia'],
      [/cache|redis/, 'Cache e performance'],
      [/queue|worker|job|task/, 'Processamento assíncrono'],
      [/log|monitor|trace|metric/, 'Logging e monitoramento'],
      [/file|upload|storage|s3/, 'Armazenamento de arquivos'],
      [/search|elastic|index/, 'Busca e indexação'],
      [/chat|message|websocket|socket/, 'Comunicação em tempo real'],
      [/i18n|locale|translation/, 'Internacionalização'],
      [/theme|style|design/, 'Design system e temas'],
      [/component|widget|ui/, 'Componentes de UI'],
      [/page|screen|view/, 'Páginas/telas'],
      [/hook|composable/, 'Hooks/composables reutilizáveis'],
      [/store|state|redux|bloc/, 'Gerenciamento de estado'],
      [/navigation|router|routing/, 'Navegação e rotas'],
    ];

    const combined = `${n} ${h}`;
    for (const [regex, desc] of patterns) {
      if (regex.test(combined)) return desc;
    }

    return `Módulo ${name}`;
  }

  // ── Entry Points ──

  private findEntryPoints(report: AnalysisReport): string[] {
    const entryPatterns = [
      /^(src\/)?(main|index|app|server|cli)\.(ts|js|py|dart|go|java)$/,
      /^(src\/)?bin\//,
      /manage\.py$/,
      /^main\.go$/,
    ];

    return report.dependencyGraph.nodes
      .filter(node => entryPatterns.some(p => p.test(node)))
      .slice(0, 5);
  }

  // ── Keywords ──

  private extractKeywords(
    packageInfo: Record<string, unknown>,
    readme: string,
    modules: ProjectSummary['modules'],
    report: AnalysisReport,
  ): string[] {
    const keywords = new Set<string>();

    // From package.json keywords
    if (Array.isArray(packageInfo.keywords)) {
      for (const kw of packageInfo.keywords) {
        if (typeof kw === 'string') keywords.add(kw.toLowerCase());
      }
    }

    // From module names
    for (const mod of modules) {
      keywords.add(mod.name.toLowerCase());
    }

    // From frameworks detected
    for (const fw of report.projectInfo.frameworks) {
      keywords.add(fw.toLowerCase());
    }

    // From languages
    for (const lang of report.projectInfo.primaryLanguages) {
      keywords.add(lang.toLowerCase());
    }

    // Filter out generic words
    const generic = new Set(['src', 'lib', 'app', 'utils', 'common', 'shared', 'core', 'index', 'main', 'dist', 'build']);
    return [...keywords].filter(kw => !generic.has(kw) && kw.length > 1).slice(0, 20);
  }

  // ── Tech Stack ──

  private buildTechStack(report: AnalysisReport, packageInfo: Record<string, unknown>): string[] {
    const stack: string[] = [];

    // Languages
    stack.push(...report.projectInfo.primaryLanguages);

    // Frameworks from report
    stack.push(...report.projectInfo.frameworks);

    // Dependencies from package.json
    const deps = { ...(packageInfo.dependencies as Record<string, string> || {}), ...(packageInfo.devDependencies as Record<string, string> || {}) };
    const notable = [
      'express', 'fastify', 'nestjs', '@nestjs/core', 'koa', 'hapi',
      'react', 'next', 'angular', 'vue', 'svelte',
      'prisma', '@prisma/client', 'typeorm', 'sequelize', 'mongoose', 'knex',
      'jest', 'mocha', 'vitest', 'cypress', 'playwright',
      'tailwindcss', 'styled-components', 'emotion',
      'redis', 'ioredis', 'bull', 'bullmq',
      'graphql', 'apollo', '@apollo/server',
      'socket.io', 'ws',
      'passport', 'jsonwebtoken', 'bcrypt',
      'winston', 'pino',
      'swagger', '@nestjs/swagger',
      'docker', 'kubernetes',
      'aws-sdk', '@aws-sdk',
      'stripe', 'paypal',
    ];

    for (const dep of Object.keys(deps)) {
      const cleaned = dep.replace('@', '').split('/')[0];
      if (notable.some(n => dep.includes(n))) {
        if (!stack.some(s => s.toLowerCase() === cleaned.toLowerCase())) {
          stack.push(dep);
        }
      }
    }

    return [...new Set(stack)].slice(0, 15);
  }

  // ── Description Builder ──

  private buildDescription(packageInfo: Record<string, unknown>, readme: string, report: AnalysisReport): string {
    // Priority 1: package.json description
    if (typeof packageInfo.description === 'string' && packageInfo.description.trim()) {
      return packageInfo.description.trim();
    }

    // Priority 2: First paragraph of README (skip badges, titles)
    if (readme) {
      const lines = readme.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines, headers, badges, links, HTML tags
        if (!trimmed) continue;
        if (trimmed.startsWith('#')) continue;
        if (trimmed.startsWith('[!') || trimmed.startsWith('[![')) continue;
        if (trimmed.startsWith('<')) continue;
        if (trimmed.startsWith('---') || trimmed.startsWith('===')) continue;
        if (trimmed.startsWith('![')) continue;
        if (trimmed.length < 20) continue;

        // Found a real text paragraph
        return trimmed.slice(0, 300);
      }
    }

    // Priority 3: Infer from project name and structure
    const name = report.projectInfo.name || 'Unknown';
    const langs = report.projectInfo.primaryLanguages.join(', ');
    const files = report.projectInfo.totalFiles;
    return `Projeto ${name} — ${files} arquivos em ${langs}`;
  }

  // ── Purpose Inference ──

  private inferPurpose(
    keywords: string[],
    modules: ProjectSummary['modules'],
    report: AnalysisReport,
  ): string {
    const allSignals = [
      ...keywords,
      ...modules.map(m => m.name.toLowerCase()),
      ...modules.map(m => m.description.toLowerCase()),
      ...report.dependencyGraph.nodes.map(n => n.toLowerCase()),
    ].join(' ');

    // Infer project type from signals
    const types: [RegExp, string][] = [
      [/api.*(rest|graph|endpoint)|controller.*route|swagger|openapi/, 'API Backend'],
      [/cli|command.*line|bin\/|yargs|commander/, 'CLI Tool'],
      [/component.*ui|react|angular|vue|frontend|page.*screen/, 'Frontend Application'],
      [/mobile|flutter|dart|react.native|ionic/, 'Mobile App'],
      [/library|lib|package|npm|pub|sdk|module/, 'Library / Package'],
      [/test|spec|validator|lint|analyz|check/, 'Tool de Análise / Validação'],
      [/microservice|service|worker|queue/, 'Microservice'],
      [/monorepo|workspace|packages\//, 'Monorepo'],
      [/bot|scraper|crawler|automation/, 'Bot / Automação'],
      [/game|canvas|webgl|three/, 'Game / Visualização'],
      [/e-?commerce|shop|cart|product|catalog/, 'E-commerce'],
      [/blog|cms|content|post|article/, 'CMS / Blog'],
      [/auth|login|oauth|sso|identity/, 'Sistema de Autenticação'],
      [/chat|message|realtime|socket/, 'Comunicação Real-time'],
      [/dashboard|admin|panel|analytics/, 'Dashboard / Admin Panel'],
      [/payment|billing|fintech|finance|bank/, 'Fintech / Pagamentos'],
      [/health|medical|patient|clinic/, 'Healthcare'],
      [/education|course|learn|student/, 'EdTech'],
    ];

    const matched: string[] = [];
    for (const [regex, type] of types) {
      if (regex.test(allSignals)) {
        matched.push(type);
      }
    }

    if (matched.length > 0) {
      return matched.slice(0, 3).join(' + ');
    }

    // Fallback
    const langs = report.projectInfo.primaryLanguages.join('/');
    return `Projeto ${langs}`;
  }
}
