import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { AnalysisReport } from '../types/core.js';
import { ProjectSummary } from '../types/summarizer.js';
import { WorkspaceInfo } from '../types/infrastructure.js';

export class ModuleInferrer {
public inferModules(report: AnalysisReport, _projectPath: string): ProjectSummary['modules'] {
    const workspaces = report.projectInfo.workspaces;

    // If we have workspaces, use them as the authoritative module list
    if (workspaces && workspaces.length > 0) {
      return this.inferModulesFromWorkspaces(workspaces, report);
    }

    // Fallback: infer from directory structure
    return this.inferModulesFromStructure(report);
  }

public inferModulesFromWorkspaces(
    workspaces: WorkspaceInfo[],
    report: AnalysisReport,
  ): ProjectSummary['modules'] {
    return workspaces
      .map((ws) => {
        // Count files belonging to this workspace
        const wsPrefix = ws.relativePath + '/';
        const fileCount = report.dependencyGraph.nodes.filter(
          (n) => n.startsWith(wsPrefix) || n.startsWith(ws.relativePath),
        ).length;

        // Get description: prefer package.json description, then README, then heuristic
        const description = this.getWorkspaceDescription(ws);

        // Use the short name (last segment of npm scope or dir name)
        const displayName = ws.name.includes('/')
          ? ws.name.split('/').pop() || ws.name
          : basename(ws.relativePath);

        return {
          name: displayName,
          files: fileCount || this.countFilesInDir(ws.path),
          description,
        };
      })
      .filter((m) => m.files > 0)
      .sort((a, b) => b.files - a.files);
  }

public getWorkspaceDescription(ws: WorkspaceInfo): string {
    // 1. package.json description (most reliable)
    if (ws.description && ws.description.trim().length > 5) {
      return ws.description.trim();
    }

    // 2. README.md first paragraph
    const readmePath = join(ws.path, 'README.md');
    if (existsSync(readmePath)) {
      try {
        const lines = readFileSync(readmePath, 'utf-8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[')
              || trimmed.startsWith('<') || trimmed.startsWith('!')
              || trimmed.length < 15) continue;
          return trimmed.slice(0, 200);
        }
      } catch {
        // skip
      }
    }

    // 3. Heuristic from name and deps
    return this.describeModule(basename(ws.relativePath), new Set(Object.keys(ws.dependencies)));
  }

public countFilesInDir(dirPath: string): number {
    try {
      const { globSync } = require('glob');
      return globSync('**/*.{ts,tsx,js,jsx,py,java,go}', {
        cwd: dirPath,
        ignore: ['**/node_modules/**', '**/dist/**'],
        nodir: true,
      }).length;
    } catch {
      return 0;
    }
  }

public inferModulesFromStructure(report: AnalysisReport): ProjectSummary['modules'] {
    const modules: Map<string, { files: Set<string>; hints: Set<string> }> = new Map();

    for (const node of report.dependencyGraph.nodes) {
      // Safety: skip any node_modules paths that leaked through
      if (node.includes('node_modules')) continue;

      const parts = node.split('/');
      // Skip root-level files
      if (parts.length < 2) continue;

      // Get the module directory (2nd level, or 1st level for flat projects)
      let moduleName: string;
      const firstDir = parts[0]!;

      // Common source directories — go one level deeper
      if (['src', 'lib', 'app', 'packages', 'modules', 'features', 'apps'].includes(firstDir)) {
        moduleName = parts.length > 2 ? parts[1]! : firstDir;
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

public describeModule(name: string, hints: Set<string>): string {
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
      [/bridge/, 'Camada de integração'],
      [/core/, 'Núcleo e orquestração'],
      [/event/, 'Sistema de eventos'],
      [/type/, 'Definições de tipos'],
      [/mcp/, 'MCP Server'],
      [/cli/, 'Interface de linha de comando'],
      [/cloud/, 'Serviço cloud / API'],
      [/autonomy/, 'Automação e self-healing'],
      [/app/, 'Aplicação principal'],
    ];

    const combined = `${n} ${h}`;
    for (const [regex, desc] of patterns) {
      if (regex.test(combined)) return desc;
    }

    return `Módulo ${name}`;
  }

}
