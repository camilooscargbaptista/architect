import { existsSync, readFileSync } from 'fs';
import { join} from 'path';
import { AnalysisReport } from '../types/core.js';
import { ProjectSummary } from '../types/summarizer.js';
// import { FileNode, WorkspaceInfo } from '../types/infrastructure.js';

export class PurposeInferrer {
public buildTechStack(report: AnalysisReport, packageInfo: Record<string, unknown>): string[] {
    const stack: string[] = [];

    // Languages
    stack.push(...report.projectInfo.primaryLanguages);

    // Frameworks from report
    stack.push(...report.projectInfo.frameworks);

    // Dependencies from package.json
    const deps = { ...(packageInfo['dependencies'] as Record<string, string> || {}), ...(packageInfo['devDependencies'] as Record<string, string> || {}) };
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
      const cleaned = dep.replace('@', '').split('/')[0]!;
      if (notable.some(n => dep.includes(n))) {
        if (!stack.some(s => s.toLowerCase() === cleaned.toLowerCase())) {
          stack.push(dep);
        }
      }
    }

    return [...new Set(stack)].slice(0, 15);
  }

public buildDescription(packageInfo: Record<string, unknown>, readme: string, report: AnalysisReport): string {
    // Priority 1: package.json description
    if (typeof packageInfo['description'] === 'string' && packageInfo['description'].trim()) {
      return packageInfo['description'].trim();
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

public inferPurpose(
    keywords: string[],
    modules: ProjectSummary['modules'],
    report: AnalysisReport,
  ): string {
    const allSignals = [
      ...keywords,
      ...modules.map(m => m.name.toLowerCase()),
      ...modules.map(m => m.description.toLowerCase()),
      // Only use project nodes, never leaked node_modules paths
      ...report.dependencyGraph.nodes
        .filter(n => !n.includes('node_modules'))
        .map(n => n.toLowerCase()),
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

public findEntryPoints(report: AnalysisReport, projectPath: string): string[] {
    const entries: string[] = [];

    // 1. From workspace bin fields
    const workspaces = report.projectInfo.workspaces;
    if (workspaces) {
      for (const ws of workspaces) {
        if (ws.bin) {
          if (typeof ws.bin === 'string') {
            entries.push(`${ws.relativePath}/${ws.bin}`);
          } else {
            for (const [, binPath] of Object.entries(ws.bin)) {
              const fullPath = `${ws.relativePath}/${binPath}`;
              entries.push(fullPath);
            }
          }
        }
        if (ws.main) {
          entries.push(`${ws.relativePath}/${ws.main}`);
        }
      }
    }

    // 2. From root package.json bin/main
    const rootPkgPath = join(projectPath, 'package.json');
    if (existsSync(rootPkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
        if (pkg.bin) {
          if (typeof pkg.bin === 'string') {
            entries.push(pkg.bin);
          } else {
            for (const [, binPath] of Object.entries(pkg.bin)) {
              entries.push(binPath as string);
            }
          }
        }
        if (pkg.main && !entries.includes(pkg.main)) {
          entries.push(pkg.main);
        }
      } catch {
        // skip
      }
    }

    // 3. Pattern-based detection (fallback)
    const entryPatterns = [
      /^(src\/)?(main|index|app|server|cli)\.(ts|js|py|dart|go|java)$/,
      /^(src\/)?bin\//,
      /^packages\/[^/]+\/src\/(main|index|app|server|cli)\.(ts|js)$/,
      /^packages\/[^/]+\/src\/bin\//,
      /manage\.py$/,
      /^main\.go$/,
    ];

    const patternEntries = report.dependencyGraph.nodes
      .filter(node => entryPatterns.some(p => p.test(node)))
      .filter(node => !entries.includes(node));

    entries.push(...patternEntries);

    return [...new Set(entries)].slice(0, 10);
  }

}
