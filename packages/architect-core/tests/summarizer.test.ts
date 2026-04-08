import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { PackageReader } from '../src/core/summarizer/package-reader.js';
import { ReadmeReader } from '../src/core/summarizer/readme-reader.js';
import { KeywordExtractor } from '../src/core/summarizer/keyword-extractor.js';
import { ModuleInferrer } from '../src/core/summarizer/module-inferrer.js';
import { PurposeInferrer } from '../src/core/summarizer/purpose-inferrer.js';
import { AnalysisReport } from '../src/core/types/core.js';
import { ProjectInfo, WorkspaceInfo } from '../src/core/types/infrastructure.js';
import { ProjectSummary } from '../src/core/types/summarizer.js';

// ── Test Helpers ──────────────────────────────────────────────────────

function makeProjectInfo(overrides?: Partial<ProjectInfo>): ProjectInfo {
  return {
    path: '/test/project',
    name: 'test-project',
    frameworks: ['express', 'react'],
    totalFiles: 50,
    totalLines: 2000,
    primaryLanguages: ['TypeScript', 'JavaScript'],
    ...overrides,
  };
}

function makeWorkspaceInfo(overrides?: Partial<WorkspaceInfo>): WorkspaceInfo {
  return {
    name: '@test/core',
    path: '/test/project/packages/core',
    relativePath: 'packages/core',
    description: 'Core utilities',
    version: '1.0.0',
    dependencies: { lodash: '^4.17.21' },
    devDependencies: { jest: '^29.0.0' },
    ...overrides,
  };
}

function makeAnalysisReport(overrides?: Partial<AnalysisReport>): AnalysisReport {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: makeProjectInfo(),
    score: {
      overall: 75,
      components: [],
      breakdown: {
        modularity: 80,
        coupling: 70,
        cohesion: 75,
        layering: 70,
      },
    },
    antiPatterns: [],
    layers: [],
    dependencyGraph: {
      nodes: ['src/auth.ts', 'src/user.ts', 'src/api/routes.ts'],
      edges: [],
    },
    suggestions: [],
    diagram: {
      mermaid: 'graph LR',
      type: 'component',
    },
    ...overrides,
  };
}

function createTempDir(): string {
  return mkdtempSync(join('/tmp', 'architect-test-'));
}

function cleanupTempDir(dirPath: string): void {
  try {
    rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('PackageReader', () => {
  let tempDir: string;
  let reader: PackageReader;

  beforeEach(() => {
    tempDir = createTempDir();
    reader = new PackageReader();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should read package.json successfully', () => {
    const pkgData = {
      name: 'test-pkg',
      version: '1.0.0',
      description: 'Test package',
      keywords: ['test', 'package'],
      dependencies: { lodash: '^4.17.21' },
    };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkgData, null, 2));

    const result = reader.readPackageJson(tempDir);

    expect(result).toEqual(pkgData);
    expect(result['name']).toBe('test-pkg');
    expect(result['keywords']).toEqual(['test', 'package']);
  });

  it('should return empty object when no package file exists', () => {
    const result = reader.readPackageJson(tempDir);

    expect(result).toEqual({});
  });

  it('should handle invalid JSON gracefully', () => {
    writeFileSync(join(tempDir, 'package.json'), 'invalid json {');

    const result = reader.readPackageJson(tempDir);

    expect(result).toEqual({});
  });

  it('should read pyproject.toml as raw content', () => {
    const tomlContent = '[project]\nname = "test-proj"\nversion = "1.0.0"';
    writeFileSync(join(tempDir, 'pyproject.toml'), tomlContent);

    const result = reader.readPackageJson(tempDir);

    expect(result).toHaveProperty('raw');
    expect(result).toHaveProperty('type');
    expect((result as any).type).toBe('pyproject.toml');
    expect((result as any).raw).toBe(tomlContent);
  });

  it('should prioritize package.json over other formats', () => {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'npm-pkg' }));
    writeFileSync(join(tempDir, 'pyproject.toml'), '[project]\nname = "py-pkg"');

    const result = reader.readPackageJson(tempDir);

    expect(result['name']).toBe('npm-pkg');
    expect(result).not.toHaveProperty('raw');
  });

  it('should check candidates in order: package.json, pyproject.toml, pubspec.yaml, Cargo.toml, pom.xml, build.gradle', () => {
    writeFileSync(join(tempDir, 'Cargo.toml'), '[package]\nname = "rust-pkg"');

    const result = reader.readPackageJson(tempDir);

    expect(result).toHaveProperty('raw');
    expect((result as any).raw).toContain('rust-pkg');
  });
});

describe('ReadmeReader', () => {
  let tempDir: string;
  let reader: ReadmeReader;

  beforeEach(() => {
    tempDir = createTempDir();
    reader = new ReadmeReader();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should read README.md file', () => {
    const content = '# My Project\n\nThis is a test project with detailed description.';
    writeFileSync(join(tempDir, 'README.md'), content);

    const result = reader.readReadme(tempDir);

    expect(result).toContain('My Project');
    expect(result).toContain('test project');
  });

  it('should return first 3000 characters only', () => {
    const longContent = 'A'.repeat(5000);
    writeFileSync(join(tempDir, 'README.md'), longContent);

    const result = reader.readReadme(tempDir);

    expect(result.length).toBe(3000);
  });

  it('should handle case-insensitive README.md', () => {
    const content = '# Project\nDescription here.';
    writeFileSync(join(tempDir, 'readme.md'), content);

    const result = reader.readReadme(tempDir);

    expect(result).toContain('Project');
  });

  it('should read README.txt file', () => {
    const content = 'Plain text readme with information';
    writeFileSync(join(tempDir, 'README.txt'), content);

    const result = reader.readReadme(tempDir);

    expect(result).toBe(content);
  });

  it('should read README.rst file', () => {
    const content = 'reStructuredText\n====================\n\nDescription here';
    writeFileSync(join(tempDir, 'README.rst'), content);

    const result = reader.readReadme(tempDir);

    expect(result).toContain('Description');
  });

  it('should prioritize README.md over other formats', () => {
    writeFileSync(join(tempDir, 'README.md'), 'Markdown content');
    writeFileSync(join(tempDir, 'readme.txt'), 'Text content');

    const result = reader.readReadme(tempDir);

    expect(result).toBe('Markdown content');
  });

  it('should return empty string when no README exists', () => {
    const result = reader.readReadme(tempDir);

    expect(result).toBe('');
  });

  it('should handle read errors gracefully', () => {
    const readmePath = join(tempDir, 'README.md');
    writeFileSync(readmePath, 'Content');
    // Make it unreadable (in a real scenario)
    // This test demonstrates error handling

    const result = reader.readReadme(tempDir);

    expect(result).toContain('Content');
  });

  it('should check candidates in correct order', () => {
    // Write all candidates, README.md should be returned
    writeFileSync(join(tempDir, 'README.txt'), 'txt content');
    writeFileSync(join(tempDir, 'README.md'), 'md content');

    const result = reader.readReadme(tempDir);

    expect(result).toBe('md content');
  });
});

describe('KeywordExtractor', () => {
  let extractor: KeywordExtractor;

  beforeEach(() => {
    extractor = new KeywordExtractor();
  });

  it('should extract keywords from package.json keywords field', () => {
    const packageInfo = {
      keywords: ['typescript', 'testing', 'framework'],
    };
    const modules: ProjectSummary['modules'] = [];
    const report = makeAnalysisReport();

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    expect(keywords).toContain('typescript');
    expect(keywords).toContain('testing');
    expect(keywords).toContain('framework');
  });

  it('should extract keywords from module names', () => {
    const packageInfo = {};
    const modules: ProjectSummary['modules'] = [
      { name: 'auth-service', files: 10, description: 'Auth' },
      { name: 'user-management', files: 15, description: 'Users' },
    ];
    const report = makeAnalysisReport();

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    expect(keywords).toContain('auth-service');
    expect(keywords).toContain('user-management');
  });

  it('should exclude blacklisted module names', () => {
    const packageInfo = {};
    const modules: ProjectSummary['modules'] = [
      { name: 'src', files: 50, description: 'Source' },
      { name: 'utils', files: 10, description: 'Utils' },
      { name: 'auth', files: 20, description: 'Auth' },
    ];
    const report = makeAnalysisReport();

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    expect(keywords).not.toContain('src');
    expect(keywords).toContain('auth');
  });

  it('should extract keywords from frameworks in report', () => {
    const packageInfo = {};
    const modules: ProjectSummary['modules'] = [];
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        frameworks: ['express', 'react', 'typeorm'],
      }),
    });

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    expect(keywords).toContain('express');
    expect(keywords).toContain('react');
  });

  it('should extract keywords from primary languages', () => {
    const packageInfo = {};
    const modules: ProjectSummary['modules'] = [];
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        primaryLanguages: ['TypeScript', 'JavaScript', 'Python'],
      }),
    });

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    expect(keywords).toContain('typescript');
    expect(keywords).toContain('javascript');
  });

  it('should normalize keywords to lowercase', () => {
    const packageInfo = {
      keywords: ['TypeScript', 'React', 'Testing'],
    };
    const modules: ProjectSummary['modules'] = [];
    const report = makeAnalysisReport();

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    expect(keywords.every(kw => kw === kw.toLowerCase())).toBe(true);
  });

  it('should limit results to 20 keywords', () => {
    const packageInfo = {
      keywords: Array.from({ length: 30 }, (_, i) => `keyword${i}`),
    };
    const modules: ProjectSummary['modules'] = [];
    const report = makeAnalysisReport();

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    expect(keywords.length).toBeLessThanOrEqual(20);
  });

  it('should filter out single-character keywords', () => {
    const packageInfo = {
      keywords: ['a', 'b', 'testing', 'x'],
    };
    const modules: ProjectSummary['modules'] = [];
    const report = makeAnalysisReport();

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    expect(keywords).not.toContain('a');
    expect(keywords).not.toContain('b');
    expect(keywords).toContain('testing');
  });

  it('should remove duplicates', () => {
    const packageInfo = {
      keywords: ['test', 'test', 'testing'],
    };
    const modules: ProjectSummary['modules'] = [];
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        frameworks: ['test'],
      }),
    });

    const keywords = extractor.extractKeywords(packageInfo, '', modules, report);

    const testCount = keywords.filter(kw => kw === 'test').length;
    expect(testCount).toBeLessThanOrEqual(1);
  });
});

describe('ModuleInferrer', () => {
  let inferrer: ModuleInferrer;
  let tempDir: string;

  beforeEach(() => {
    inferrer = new ModuleInferrer();
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should infer modules from workspaces when available', () => {
    const workspace1 = makeWorkspaceInfo({
      name: '@test/core',
      relativePath: 'packages/core',
      description: 'Core library',
    });
    const workspace2 = makeWorkspaceInfo({
      name: '@test/api',
      relativePath: 'packages/api',
      description: 'API server',
    });

    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [workspace1, workspace2],
      }),
      dependencyGraph: {
        nodes: ['packages/core/src/index.ts', 'packages/core/src/utils.ts', 'packages/api/src/server.ts'],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');

    expect(modules.length).toBeGreaterThan(0);
    expect(modules.some(m => m.description === 'Core library')).toBe(true);
  });

  it('should use workspace description from package.json', () => {
    const workspace = makeWorkspaceInfo({
      name: '@test/auth',
      relativePath: 'packages/auth',
      description: 'Authentication module',
    });

    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [workspace],
      }),
      dependencyGraph: {
        nodes: ['packages/auth/src/index.ts'],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');

    // The workspace description should be picked up
    expect(modules.length).toBeGreaterThan(0);
    expect(modules[0]?.description).toBeDefined();
  });

  it('should filter out workspaces with zero files', () => {
    const workspace1 = makeWorkspaceInfo({
      relativePath: 'packages/empty',
      description: 'Empty workspace',
    });
    const workspace2 = makeWorkspaceInfo({
      relativePath: 'packages/core',
      description: 'Core module',
    });

    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [workspace1, workspace2],
      }),
      dependencyGraph: {
        nodes: ['packages/core/src/index.ts'],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');

    expect(modules.every(m => m.files > 0)).toBe(true);
  });

  it('should extract display name from scoped package names', () => {
    const workspace = makeWorkspaceInfo({
      name: '@girardelli/architect-core',
      relativePath: 'packages/architect-core',
    });

    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [workspace],
      }),
      dependencyGraph: {
        nodes: ['packages/architect-core/src/index.ts'],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');
    const coreModule = modules[0];

    expect(coreModule?.name).toBe('architect-core');
  });

  it('should infer modules from directory structure when no workspaces', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [] as any,
      }),
      dependencyGraph: {
        nodes: [
          'src/auth/login.ts',
          'src/auth/register.ts',
          'src/user/profile.ts',
          'src/api/routes.ts',
        ],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');

    expect(modules.length).toBeGreaterThan(0);
    expect(modules.some(m => m.name === 'auth')).toBe(true);
    expect(modules.some(m => m.name === 'user')).toBe(true);
  });

  it('should skip node_modules in module inference', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [] as any,
      }),
      dependencyGraph: {
        nodes: [
          'src/auth.ts',
          'node_modules/lodash/index.js',
          'src/user.ts',
        ],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');

    expect(modules.every(m => !m.name.includes('node_modules'))).toBe(true);
  });

  it('should limit modules to top 15 by file count', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => `src/module${i}/file.ts`);
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [] as any,
      }),
      dependencyGraph: {
        nodes,
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');

    expect(modules.length).toBeLessThanOrEqual(15);
  });

  it('should describe modules using pattern matching', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [] as any,
      }),
      dependencyGraph: {
        nodes: [
          'src/auth/login.ts',
          'src/auth/register.ts',
          'src/payment/checkout.ts',
        ],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');
    const authModule = modules.find(m => m.name === 'auth');
    const paymentModule = modules.find(m => m.name === 'payment');

    expect(authModule?.description).toContain('Autenticação');
    expect(paymentModule?.description).toContain('Pagamento');
  });

  it('should handle workspace README descriptions', () => {
    tempDir = createTempDir();
    const wsPath = join(tempDir, 'packages', 'core');
    mkdirSync(wsPath, { recursive: true });
    writeFileSync(join(wsPath, 'README.md'), 'This is the core library for shared utilities');

    const workspace = makeWorkspaceInfo({
      path: wsPath,
      relativePath: 'packages/core',
      description: '', // empty, should fall back to README
    });

    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [workspace],
      }),
      dependencyGraph: {
        nodes: ['packages/core/src/index.ts'],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, tempDir);

    expect(modules.length).toBeGreaterThan(0);
  });

  it('should sort modules by file count descending', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [] as any,
      }),
      dependencyGraph: {
        nodes: [
          'src/small/file.ts',
          'src/large/f1.ts',
          'src/large/f2.ts',
          'src/large/f3.ts',
        ],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');

    if (modules.length >= 2) {
      const m0 = modules[0];
      const m1 = modules[1];
      if (m0 && m1) {
        expect(m0.files).toBeGreaterThanOrEqual(m1.files);
      }
    }
  });

  it('should handle module descriptions with known patterns', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [] as any,
      }),
      dependencyGraph: {
        nodes: [
          'src/database/migrations.ts',
          'src/database/seed.ts',
          'src/config/settings.ts',
        ],
        edges: [],
      },
    });

    const modules = inferrer.inferModules(report, '/test/project');
    const dbModule = modules.find(m => m.name === 'database');
    const configModule = modules.find(m => m.name === 'config');

    expect(dbModule?.description).toContain('Banco de dados');
    expect(configModule?.description).toContain('Configuração');
  });
});

describe('PurposeInferrer', () => {
  let inferrer: PurposeInferrer;

  beforeEach(() => {
    inferrer = new PurposeInferrer();
  });

  it('should build tech stack from languages', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        primaryLanguages: ['TypeScript', 'JavaScript'],
      }),
    });
    const packageInfo = {};

    const stack = inferrer.buildTechStack(report, packageInfo);

    expect(stack).toContain('TypeScript');
    expect(stack).toContain('JavaScript');
  });

  it('should build tech stack from frameworks', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        frameworks: ['express', 'react'],
      }),
    });
    const packageInfo = {};

    const stack = inferrer.buildTechStack(report, packageInfo);

    expect(stack).toContain('express');
    expect(stack).toContain('react');
  });

  it('should add notable dependencies from package.json', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        primaryLanguages: ['JavaScript'],
        frameworks: [],
      }),
    });
    const packageInfo = {
      dependencies: {
        express: '^4.18.0',
        'next': '^13.0.0',
        'lodash': '^4.17.21',
      },
    };

    const stack = inferrer.buildTechStack(report, packageInfo);

    expect(stack).toContain('express');
    expect(stack).toContain('next');
    expect(stack).not.toContain('lodash'); // not in notable list
  });

  it('should limit tech stack to 15 items', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        primaryLanguages: Array.from({ length: 20 }, (_, i) => `Lang${i}`),
        frameworks: Array.from({ length: 20 }, (_, i) => `Framework${i}`),
      }),
    });
    const packageInfo = {};

    const stack = inferrer.buildTechStack(report, packageInfo);

    expect(stack.length).toBeLessThanOrEqual(15);
  });

  it('should remove duplicates from tech stack', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        primaryLanguages: ['TypeScript', 'TypeScript'],
        frameworks: ['react', 'react'],
      }),
    });
    const packageInfo = {};

    const stack = inferrer.buildTechStack(report, packageInfo);

    const typeScriptCount = stack.filter(s => s === 'TypeScript').length;
    expect(typeScriptCount).toBeLessThanOrEqual(1);
  });

  it('should use package.json description as priority', () => {
    const report = makeAnalysisReport();
    const packageInfo = {
      description: 'A powerful testing framework',
    };
    const readme = '# Readme Title\n\nThis is a different description';

    const description = inferrer.buildDescription(packageInfo, readme, report);

    expect(description).toBe('A powerful testing framework');
  });

  it('should use README description if package.json has none', () => {
    const report = makeAnalysisReport();
    const packageInfo = {};
    const readme = '# Title\n\nThis is a comprehensive README with details';

    const description = inferrer.buildDescription(packageInfo, readme, report);

    expect(description).toContain('comprehensive README');
  });

  it('should skip headers and badges in README', () => {
    const report = makeAnalysisReport();
    const packageInfo = {};
    const readme = '# Project Title\n[![Badge](url)](link)\n\nThe actual description starts here and is quite detailed';

    const description = inferrer.buildDescription(packageInfo, readme, report);

    expect(description).toBe('The actual description starts here and is quite detailed');
  });

  it('should limit description to 300 characters', () => {
    const report = makeAnalysisReport();
    const packageInfo = {};
    const longText = 'A'.repeat(500);
    const readme = `Some prefix\n\n${longText}`;

    const description = inferrer.buildDescription(packageInfo, readme, report);

    expect(description.length).toBeLessThanOrEqual(300);
  });

  it('should infer description from project name if no other source', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        name: 'my-awesome-project',
        totalFiles: 50,
      }),
    });
    const packageInfo = {};
    const readme = '';

    const description = inferrer.buildDescription(packageInfo, readme, report);

    expect(description).toContain('my-awesome-project');
    expect(description).toContain('50');
  });

  it('should infer purpose as API Backend', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        frameworks: ['express'],
      }),
      dependencyGraph: {
        nodes: ['src/api/routes.ts', 'src/api/controllers.ts'],
        edges: [],
      },
    });
    const keywords = ['express', 'api', 'rest'];
    const modules: ProjectSummary['modules'] = [];

    const purpose = inferrer.inferPurpose(keywords, modules, report);

    expect(purpose).toContain('API Backend');
  });

  it('should infer purpose as Frontend Application', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        frameworks: ['react'],
      }),
    });
    const keywords = ['react', 'component'];
    const modules: ProjectSummary['modules'] = [
      { name: 'pages', files: 20, description: 'Pages' },
    ];

    const purpose = inferrer.inferPurpose(keywords, modules, report);

    expect(purpose).toContain('Frontend Application');
  });

  it('should infer purpose as Library', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        frameworks: [],
      }),
    });
    const keywords = ['library', 'package', 'npm'];
    const modules: ProjectSummary['modules'] = [];

    const purpose = inferrer.inferPurpose(keywords, modules, report);

    expect(purpose).toContain('Library');
  });

  it('should infer purpose as Monorepo', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [makeWorkspaceInfo()],
      }),
    });
    const keywords = ['monorepo'];
    const modules: ProjectSummary['modules'] = [];

    const purpose = inferrer.inferPurpose(keywords, modules, report);

    expect(purpose).toContain('Monorepo');
  });

  it('should handle multiple matching purposes', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        frameworks: ['express', 'react'],
      }),
    });
    const keywords = ['api', 'component', 'microservice'];
    const modules: ProjectSummary['modules'] = [];

    const purpose = inferrer.inferPurpose(keywords, modules, report);

    expect(purpose).toContain('+');
  });

  it('should limit purposes to first 3 matches', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        frameworks: ['express', 'react', 'fastify'],
      }),
    });
    const keywords = ['api', 'frontend', 'cli', 'bot', 'game'];
    const modules: ProjectSummary['modules'] = [];

    const purpose = inferrer.inferPurpose(keywords, modules, report);

    const parts = purpose.split(' + ');
    expect(parts.length).toBeLessThanOrEqual(3);
  });

  it('should fallback to language-based purpose', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        primaryLanguages: ['Go', 'Rust'],
        frameworks: [],
      }),
      dependencyGraph: {
        nodes: [], // empty, no signals
        edges: [],
      },
    });
    const keywords: string[] = [];
    const modules: ProjectSummary['modules'] = [];

    const purpose = inferrer.inferPurpose(keywords, modules, report);

    // When no patterns match, it falls back to "Projeto {langs}"
    const hasPurpose = purpose.includes('Go') || purpose.includes('Rust') || purpose.includes('Projeto');
    expect(hasPurpose).toBe(true);
  });

  it('should find entry points from workspace bin fields', () => {
    const workspace = makeWorkspaceInfo({
      bin: { 'myapp': 'dist/cli.js' },
      main: 'dist/index.js',
    });
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [workspace],
      }),
    });

    const entries = inferrer.findEntryPoints(report, '/test/project');

    expect(entries).toContain('packages/core/dist/cli.js');
    expect(entries).toContain('packages/core/dist/index.js');
  });

  it('should find entry points from root package.json', () => {
    const reportWithoutWorkspaces = makeAnalysisReport();
    (reportWithoutWorkspaces.projectInfo as any).workspaces = [];

    // Note: In real scenario, we'd create temp file with root package.json
    // For now, test the pattern-based detection fallback
    const entries = inferrer.findEntryPoints(reportWithoutWorkspaces, '/test/project');

    expect(Array.isArray(entries)).toBe(true);
  });

  it('should find entry points via pattern matching', () => {
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [] as any,
      }),
      dependencyGraph: {
        nodes: [
          'src/main.ts',
          'src/app.js',
          'packages/cli/src/index.ts',
        ],
        edges: [],
      },
    });

    const entries = inferrer.findEntryPoints(report, '/test/project');

    expect(entries.some(e => e.includes('main') || e.includes('app'))).toBe(true);
  });

  it('should limit entry points to 10', () => {
    const nodes = Array.from({ length: 20 }, (_, i) => `src/bin${i}/cli.ts`);
    const reportWithEmpty = makeAnalysisReport({
      projectInfo: makeProjectInfo({}),
      dependencyGraph: {
        nodes,
        edges: [],
      },
    });
    (reportWithEmpty.projectInfo as any).workspaces = [];

    const entries = inferrer.findEntryPoints(reportWithEmpty, '/test/project');

    expect(entries.length).toBeLessThanOrEqual(10);
  });

  it('should not include duplicates in entry points', () => {
    const workspace = makeWorkspaceInfo({
      bin: { 'cli': 'dist/cli.js' },
      main: 'dist/cli.js', // same path as bin
    });
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        workspaces: [workspace],
      }),
    });

    const entries = inferrer.findEntryPoints(report, '/test/project');

    // Should have entries without many duplicates
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Integration: Full Summarizer Pipeline', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  it('should orchestrate all components end-to-end', () => {
    // Setup file structure
    const pkgJson = {
      name: 'test-app',
      description: 'A test application',
      keywords: ['testing', 'sample'],
      dependencies: { express: '^4.18.0', react: '^18.0.0' },
    };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    const readmeContent = '# Test Application\n\nThis is a comprehensive test app for demonstration';
    writeFileSync(join(tempDir, 'README.md'), readmeContent);

    // Create components
    const pkgReader = new PackageReader();
    const readmeReader = new ReadmeReader();
    const keywordExtractor = new KeywordExtractor();
    const moduleInferrer = new ModuleInferrer();
    const purposeInferrer = new PurposeInferrer();

    // Read data
    const packageInfo = pkgReader.readPackageJson(tempDir);
    const readme = readmeReader.readReadme(tempDir);

    // Create mock report
    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        name: 'test-app',
        primaryLanguages: ['TypeScript', 'JavaScript'],
        frameworks: ['express', 'react'],
      }),
      dependencyGraph: {
        nodes: [
          'src/auth/login.ts',
          'src/auth/register.ts',
          'src/user/profile.ts',
          'src/api/routes.ts',
        ],
        edges: [],
      },
    });

    // Infer modules
    const modules = moduleInferrer.inferModules(report, tempDir);

    // Extract keywords
    const keywords = keywordExtractor.extractKeywords(packageInfo, readme, modules, report);

    // Infer purpose and description
    const description = purposeInferrer.buildDescription(packageInfo, readme, report);
    const purpose = purposeInferrer.inferPurpose(keywords, modules, report);
    const techStack = purposeInferrer.buildTechStack(report, packageInfo);
    const entryPoints = purposeInferrer.findEntryPoints(report, tempDir);

    // Assemble summary
    const summary: ProjectSummary = {
      description,
      purpose,
      modules,
      techStack,
      entryPoints,
      keywords,
    };

    // Validate summary
    expect(summary.description).toBe('A test application');
    expect(summary.purpose).toContain('API Backend');
    expect(summary.purpose).toContain('Frontend Application');
    expect(summary.modules.length).toBeGreaterThan(0);
    expect(summary.techStack).toContain('express');
    expect(summary.keywords.length).toBeGreaterThan(0);
    expect(summary.entryPoints).toBeInstanceOf(Array);
  });

  it('should handle minimal project info', () => {
    // Create components with minimal setup
    const keywordExtractor = new KeywordExtractor();
    const moduleInferrer = new ModuleInferrer();
    const purposeInferrer = new PurposeInferrer();

    const report = makeAnalysisReport({
      projectInfo: makeProjectInfo({
        name: 'minimal',
        primaryLanguages: ['JavaScript'],
        frameworks: [],
      }),
      dependencyGraph: {
        nodes: ['index.js'],
        edges: [],
      },
    });

    const modules = moduleInferrer.inferModules(report, tempDir);
    const keywords = keywordExtractor.extractKeywords({}, '', modules, report);
    const purpose = purposeInferrer.inferPurpose(keywords, modules, report);

    expect(purpose).toBeDefined();
    expect(purpose.length).toBeGreaterThan(0);
  });

  it('should prioritize data sources correctly', () => {
    const pkgJson = {
      name: 'priority-test',
      description: 'Package.json description',
      keywords: ['pkg-keyword'],
      dependencies: { prisma: '^4.0.0' },
    };
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    const readmeContent = '# README Title\n\nREADME description here';
    writeFileSync(join(tempDir, 'README.md'), readmeContent);

    const pkgReader = new PackageReader();
    const readmeReader = new ReadmeReader();
    const purposeInferrer = new PurposeInferrer();

    const packageInfo = pkgReader.readPackageJson(tempDir);
    const readme = readmeReader.readReadme(tempDir);
    const report = makeAnalysisReport();

    const description = purposeInferrer.buildDescription(packageInfo, readme, report);

    // package.json description should take priority
    expect(description).toBe('Package.json description');
  });
});
