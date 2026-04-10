import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AnalysisReport } from '../types.js';
import { FrameworkInfo, DetectedToolchain, StackInfo } from './types.js';

/**
 * FrameworkDetector — Detects actual frameworks and toolchain from dependency files.
 *
 * Reads requirements.txt, pyproject.toml, package.json, pom.xml, build.gradle,
 * composer.json, go.mod, Gemfile, pubspec.yaml, Cargo.toml, Makefile, etc.
 *
 * Returns structured framework info with versions, categories, and
 * auto-detected toolchain commands (build, test, lint, run).
 */
export class FrameworkDetector {

  // ═══════════════════════════════════════════════════════════════════════
  // FRAMEWORK PATTERNS — Maps dependency names to framework metadata
  // ═══════════════════════════════════════════════════════════════════════

  private static readonly FRAMEWORK_MAP: Record<string, { name: string; category: FrameworkInfo['category'] }> = {
    // Python Web
    'fastapi': { name: 'FastAPI', category: 'web' },
    'django': { name: 'Django', category: 'web' },
    'flask': { name: 'Flask', category: 'web' },
    'starlette': { name: 'Starlette', category: 'web' },
    'tornado': { name: 'Tornado', category: 'web' },
    'sanic': { name: 'Sanic', category: 'web' },
    'aiohttp': { name: 'aiohttp', category: 'web' },
    'litestar': { name: 'Litestar', category: 'web' },
    // Python ORM
    'sqlalchemy': { name: 'SQLAlchemy', category: 'orm' },
    'tortoise-orm': { name: 'Tortoise ORM', category: 'orm' },
    'peewee': { name: 'Peewee', category: 'orm' },
    'sqlmodel': { name: 'SQLModel', category: 'orm' },
    'prisma': { name: 'Prisma', category: 'orm' },
    'django-rest-framework': { name: 'DRF', category: 'web' },
    'djangorestframework': { name: 'DRF', category: 'web' },
    // Python Test
    'pytest': { name: 'pytest', category: 'test' },
    'unittest': { name: 'unittest', category: 'test' },
    'hypothesis': { name: 'Hypothesis', category: 'test' },
    // Python Lint
    'ruff': { name: 'Ruff', category: 'lint' },
    'flake8': { name: 'Flake8', category: 'lint' },
    'pylint': { name: 'Pylint', category: 'lint' },
    'black': { name: 'Black', category: 'lint' },
    'mypy': { name: 'mypy', category: 'lint' },
    // Node.js Web
    '@nestjs/core': { name: 'NestJS', category: 'web' },
    'express': { name: 'Express', category: 'web' },
    'fastify': { name: 'Fastify', category: 'web' },
    'koa': { name: 'Koa', category: 'web' },
    'hapi': { name: 'Hapi', category: 'web' },
    '@hapi/hapi': { name: 'Hapi', category: 'web' },
    'next': { name: 'Next.js', category: 'web' },
    'nuxt': { name: 'Nuxt', category: 'web' },
    // Node.js ORM
    'typeorm': { name: 'TypeORM', category: 'orm' },
    '@prisma/client': { name: 'Prisma', category: 'orm' },
    'sequelize': { name: 'Sequelize', category: 'orm' },
    'mongoose': { name: 'Mongoose', category: 'orm' },
    'knex': { name: 'Knex', category: 'orm' },
    'drizzle-orm': { name: 'Drizzle', category: 'orm' },
    // Node.js Test
    'jest': { name: 'Jest', category: 'test' },
    'vitest': { name: 'Vitest', category: 'test' },
    'mocha': { name: 'Mocha', category: 'test' },
    // Node.js Lint
    'eslint': { name: 'ESLint', category: 'lint' },
    'biome': { name: 'Biome', category: 'lint' },
    '@biomejs/biome': { name: 'Biome', category: 'lint' },
    'prettier': { name: 'Prettier', category: 'lint' },
    // Java/Kotlin
    'spring-boot-starter-web': { name: 'Spring Boot', category: 'web' },
    'spring-boot-starter': { name: 'Spring Boot', category: 'web' },
    'quarkus': { name: 'Quarkus', category: 'web' },
    'micronaut': { name: 'Micronaut', category: 'web' },
    'ktor': { name: 'Ktor', category: 'web' },
    // PHP
    'laravel/framework': { name: 'Laravel', category: 'web' },
    'symfony/framework-bundle': { name: 'Symfony', category: 'web' },
    'slim/slim': { name: 'Slim', category: 'web' },
    // Ruby
    'rails': { name: 'Ruby on Rails', category: 'web' },
    // Go — detected from imports
    'gin-gonic/gin': { name: 'Gin', category: 'web' },
    'labstack/echo': { name: 'Echo', category: 'web' },
    'gofiber/fiber': { name: 'Fiber', category: 'web' },
    'gorilla/mux': { name: 'Gorilla Mux', category: 'web' },
    'go-chi/chi': { name: 'Chi', category: 'web' },
    // Dart/Flutter
    'flutter': { name: 'Flutter', category: 'web' },
    'shelf': { name: 'Shelf', category: 'web' },
    'dart_frog': { name: 'Dart Frog', category: 'web' },
    // Rust
    'actix-web': { name: 'Actix Web', category: 'web' },
    'rocket': { name: 'Rocket', category: 'web' },
    'axum': { name: 'Axum', category: 'web' },
  };

  // ═══════════════════════════════════════════════════════════════════════
  // DETECTION — Main entry point
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Detect frameworks and toolchain from project path and report.
   */
  detect(projectPath: string, report: AnalysisReport): {
    frameworks: FrameworkInfo[];
    primaryFramework: FrameworkInfo | null;
    toolchain: DetectedToolchain;
    projectStructure: 'clean-architecture' | 'mvc' | 'modular' | 'flat' | 'monorepo' | 'unknown';
  } {
    const frameworks: FrameworkInfo[] = [];

    // Try each dependency source
    this.detectFromPython(projectPath, frameworks);
    this.detectFromNodejs(projectPath, frameworks);
    this.detectFromJava(projectPath, frameworks);
    this.detectFromPhp(projectPath, frameworks);
    this.detectFromGo(projectPath, frameworks);
    this.detectFromRuby(projectPath, frameworks);
    this.detectFromDart(projectPath, frameworks);
    this.detectFromRust(projectPath, frameworks);

    // Deduplicate by name
    const seen = new Set<string>();
    const unique = frameworks.filter(f => {
      if (seen.has(f.name)) return false;
      seen.add(f.name);
      return true;
    });

    // Sort: web frameworks first, then by confidence
    unique.sort((a, b) => {
      if (a.category === 'web' && b.category !== 'web') return -1;
      if (a.category !== 'web' && b.category === 'web') return 1;
      return b.confidence - a.confidence;
    });

    const primaryFramework = unique.find(f => f.category === 'web') || null;
    const toolchain = this.detectToolchain(projectPath, report, primaryFramework, unique);
    const projectStructure = this.detectProjectStructure(report);

    return { frameworks: unique, primaryFramework, toolchain, projectStructure };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // STACK DETECTION — produces the compact StackInfo used by agent-generator
  // (consolidated from the former stack-detector.ts so there is ONE source
  // of truth for framework/language detection).
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Produce a compact {@link StackInfo} for agent-generator templates.
   *
   * Reuses the rich dependency-file detection from {@link detect} and adds
   * derived flags (hasBackend/hasFrontend/hasMobile/hasDatabase) plus
   * package-manager and test-framework fallbacks.
   */
  detectStack(report: AnalysisReport, projectPath: string): StackInfo {
    const files = report.dependencyGraph.nodes;
    const extensions = new Set<string>();
    for (const file of files) {
      const ext = file.split('.').pop()?.toLowerCase() || '';
      if (ext) extensions.add(ext);
    }

    // ── Languages ──
    // Prefer the primary languages already computed by the scanner.
    const languages = new Set<string>();
    for (const lang of report.projectInfo.primaryLanguages || []) {
      // Canonicalise Kotlin/Java for downstream template matching.
      if (lang === 'Kotlin' || lang === 'Java') languages.add('Java/Kotlin');
      else languages.add(lang);
    }

    // ── Frameworks ──
    // Defer to full detect() so we pick up real dependency-file frameworks.
    const detection = this.detect(projectPath, report);
    const frameworks = new Set(detection.frameworks.map((f) => f.name));

    // File-tree fallbacks for cases where dependency files are missing or
    // haven't been parsed yet. These are heuristics — {@link detect} is the
    // authoritative source whenever dependency files are available.
    const allFiles = files.join(' ');

    // Language-agnostic file/extension hints
    if (allFiles.includes('.vue')) frameworks.add('Vue');
    if (allFiles.includes('.dart')) frameworks.add('Flutter');
    if (allFiles.includes('go.mod')) frameworks.add('Go Modules');
    if (allFiles.includes('Cargo.toml')) frameworks.add('Cargo');

    // TypeScript/JavaScript path hints
    if (files.some((f) => f.endsWith('.module.ts') || f.includes('nest-cli.json'))) {
      frameworks.add('NestJS');
    }
    if (files.some((f) => f.endsWith('.component.ts') || f.endsWith('angular.json'))) {
      frameworks.add('Angular');
    }
    if (
      files.some(
        (f) =>
          f.endsWith('next.config.js') ||
          f.endsWith('next.config.ts') ||
          /\/pages\/.+\.(tsx|jsx|ts|js)$/.test(f),
      )
    ) {
      frameworks.add('Next.js');
    }
    if (files.some((f) => /\.(tsx|jsx)$/.test(f))) {
      frameworks.add('React');
    }

    // Python path hints
    if (files.some((f) => f.endsWith('manage.py') || /\/views\.py$/.test(f) || /\/models\.py$/.test(f))) {
      frameworks.add('Django');
    }
    if (files.some((f) => /\/app\.py$/.test(f) || /\/wsgi\.py$/.test(f))) {
      frameworks.add('Flask');
    }

    // Java path hints
    if (files.some((f) => f.endsWith('pom.xml'))) {
      frameworks.add('Spring');
    }

    const primary = languages.size > 0 ? [...languages][0] : 'Unknown';

    const hasBackend =
      languages.has('Python') || languages.has('TypeScript') ||
      languages.has('JavaScript') || languages.has('Go') ||
      languages.has('Java/Kotlin') || languages.has('Ruby') ||
      languages.has('PHP') || languages.has('C#') || languages.has('Rust');

    const hasFrontend =
      frameworks.has('Angular') || frameworks.has('Vue') ||
      frameworks.has('Next.js') || frameworks.has('React') ||
      frameworks.has('Nuxt') || extensions.has('tsx') ||
      extensions.has('jsx') || extensions.has('html');

    const hasMobile = languages.has('Dart') || frameworks.has('Flutter');

    const hasDatabase =
      detection.frameworks.some((f) => f.category === 'orm') ||
      allFiles.includes('migration') || allFiles.includes('entity') ||
      allFiles.includes('prisma') || allFiles.includes('typeorm') ||
      allFiles.includes('schema');

    const testFramework =
      detection.frameworks.find((f) => f.category === 'test')?.name ||
      this.fallbackTestFramework(languages, frameworks);

    const packageManager = this.detectPackageManager(languages);

    return {
      primary,
      languages: [...languages],
      frameworks: [...frameworks],
      hasBackend,
      hasFrontend,
      hasMobile,
      hasDatabase,
      testFramework,
      packageManager,
    };
  }

  private fallbackTestFramework(languages: Set<string>, frameworks: Set<string>): string {
    if (languages.has('Dart')) return 'flutter_test';
    if (languages.has('Python')) return 'pytest';
    if (languages.has('Go')) return 'go test';
    if (languages.has('Java/Kotlin')) return 'JUnit';
    if (languages.has('Ruby')) return 'RSpec';
    if (languages.has('C#')) return 'xUnit';
    if (languages.has('Rust')) return 'cargo test';
    if (frameworks.has('Angular')) return 'Jest + Jasmine';
    return 'Jest';
  }

  private detectPackageManager(languages: Set<string>): string {
    if (languages.has('Python')) return 'pip';
    if (languages.has('Go')) return 'go mod';
    if (languages.has('Dart')) return 'pub';
    if (languages.has('Ruby')) return 'bundler';
    if (languages.has('Java/Kotlin')) return 'gradle/maven';
    if (languages.has('Rust')) return 'cargo';
    if (languages.has('PHP')) return 'composer';
    if (languages.has('C#')) return 'nuget';
    return 'npm';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PYTHON
  // ═══════════════════════════════════════════════════════════════════════

  private detectFromPython(projectPath: string, out: FrameworkInfo[]): void {
    // requirements.txt
    const reqFiles = ['requirements.txt', 'requirements/base.txt', 'requirements/prod.txt'];
    for (const reqFile of reqFiles) {
      const path = join(projectPath, reqFile);
      if (existsSync(path)) {
        const content = this.safeReadFile(path);
        this.parsePythonRequirements(content, out);
      }
    }

    // pyproject.toml
    const pyproject = join(projectPath, 'pyproject.toml');
    if (existsSync(pyproject)) {
      const content = this.safeReadFile(pyproject);
      this.parsePyprojectToml(content, out);
    }

    // setup.py / setup.cfg
    const setupPy = join(projectPath, 'setup.py');
    if (existsSync(setupPy)) {
      const content = this.safeReadFile(setupPy);
      this.parsePythonRequirements(content, out);
    }

    // Pipfile
    const pipfile = join(projectPath, 'Pipfile');
    if (existsSync(pipfile)) {
      const content = this.safeReadFile(pipfile);
      this.parsePythonRequirements(content, out);
    }
  }

  private parsePythonRequirements(content: string, out: FrameworkInfo[]): void {
    const lines = content.toLowerCase().split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/#.*$/, '').trim();
      if (!cleaned) continue;

      // Match: package==1.0.0, package>=1.0, package~=1.0, package[extras]
      const match = cleaned.match(/^([a-z0-9_-]+)(?:\[.*?\])?\s*(?:[=<>~!]+\s*([0-9][0-9.]*\S*))?/);
      if (match) {
        const pkg = match[1].replace(/-/g, '-');
        const version = match[2] || null;
        const fwInfo = FrameworkDetector.FRAMEWORK_MAP[pkg];
        if (fwInfo) {
          out.push({ name: fwInfo.name, version, category: fwInfo.category, confidence: 0.95 });
        }
      }
    }
  }

  private parsePyprojectToml(content: string, out: FrameworkInfo[]): void {
    // Strategy 1: [project.dependencies] section (legacy format)
    const depSection = content.match(/\[(?:project\.)?dependencies\]([\s\S]*?)(?:\n\[|$)/);
    if (depSection) {
      this.parsePythonRequirements(depSection[1], out);
    }

    // Strategy 2: [project] section with inline `dependencies = [...]` (PEP 621 format)
    // This is the standard pyproject.toml format used by most modern Python projects
    const projectSection = content.match(/\[project\]\s*\n([\s\S]*?)(?:\n\[(?!project\.)|$)/);
    if (projectSection) {
      // Extract the dependencies array: dependencies = [ "pkg>=1.0", ... ]
      const depsArrayMatch = projectSection[1].match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
      if (depsArrayMatch) {
        // Extract quoted strings from the array
        const deps = depsArrayMatch[1].match(/"([^"]+)"/g);
        if (deps) {
          const depsAsLines = deps.map(d => d.replace(/"/g, '')).join('\n');
          this.parsePythonRequirements(depsAsLines, out);
        }
      }
    }

    // Strategy 3: [project.optional-dependencies] sections (dev, test, etc.)
    const optionalDeps = content.match(/\[project\.optional-dependencies\]\s*\n([\s\S]*?)(?:\n\[(?!project\.)|$)/);
    if (optionalDeps) {
      // Parse each group: dev = ["pkg>=1.0", ...], test = [...]
      const groupMatches = optionalDeps[1].matchAll(/\w+\s*=\s*\[([\s\S]*?)\]/g);
      for (const groupMatch of groupMatches) {
        const deps = groupMatch[1].match(/"([^"]+)"/g);
        if (deps) {
          const depsAsLines = deps.map(d => d.replace(/"/g, '')).join('\n');
          this.parsePythonRequirements(depsAsLines, out);
        }
      }
    }

    // Strategy 4: tool.poetry.dependencies
    const poetrySection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\n\[|$)/);
    if (poetrySection) {
      const lines = poetrySection[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^([a-z0-9_-]+)\s*=\s*"?([^"]*)"?/i);
        if (match) {
          const pkg = match[1].toLowerCase();
          const fwInfo = FrameworkDetector.FRAMEWORK_MAP[pkg];
          if (fwInfo) {
            const versionMatch = match[2].match(/([0-9][0-9.]*)/);
            out.push({ name: fwInfo.name, version: versionMatch?.[1] || null, category: fwInfo.category, confidence: 0.95 });
          }
        }
      }
    }

    // Deduplicate by framework name (keep highest confidence)
    const seen = new Map<string, number>();
    for (let i = out.length - 1; i >= 0; i--) {
      const key = out[i].name;
      if (seen.has(key)) {
        out.splice(i, 1);
      } else {
        seen.set(key, i);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // NODE.JS / TypeScript
  // ═══════════════════════════════════════════════════════════════════════

  private detectFromNodejs(projectPath: string, out: FrameworkInfo[]): void {
    const pkgPath = join(projectPath, 'package.json');
    if (!existsSync(pkgPath)) return;

    const content = this.safeReadFile(pkgPath);
    try {
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(allDeps)) {
        const fwInfo = FrameworkDetector.FRAMEWORK_MAP[name];
        if (fwInfo) {
          const vStr = typeof version === 'string' ? version : '';
          const vMatch = vStr.match(/([0-9][0-9.]*)/);
          out.push({ name: fwInfo.name, version: vMatch?.[1] || null, category: fwInfo.category, confidence: 0.95 });
        }
      }
    } catch {
      // Invalid JSON
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // JAVA / Kotlin
  // ═══════════════════════════════════════════════════════════════════════

  private detectFromJava(projectPath: string, out: FrameworkInfo[]): void {
    // pom.xml
    const pomPath = join(projectPath, 'pom.xml');
    if (existsSync(pomPath)) {
      const content = this.safeReadFile(pomPath);
      const deps = content.match(/<artifactId>([^<]+)<\/artifactId>/gi) || [];
      for (const dep of deps) {
        const match = dep.match(/<artifactId>([^<]+)<\/artifactId>/i);
        if (match) {
          const artifact = match[1].toLowerCase();
          const fwInfo = FrameworkDetector.FRAMEWORK_MAP[artifact];
          if (fwInfo) {
            out.push({ name: fwInfo.name, version: null, category: fwInfo.category, confidence: 0.85 });
          }
        }
      }
    }

    // build.gradle / build.gradle.kts
    for (const gradleFile of ['build.gradle', 'build.gradle.kts']) {
      const gradlePath = join(projectPath, gradleFile);
      if (existsSync(gradlePath)) {
        const content = this.safeReadFile(gradlePath);
        if (content.includes('spring-boot')) {
          out.push({ name: 'Spring Boot', version: null, category: 'web', confidence: 0.9 });
        }
        if (content.includes('quarkus')) {
          out.push({ name: 'Quarkus', version: null, category: 'web', confidence: 0.9 });
        }
        if (content.includes('micronaut')) {
          out.push({ name: 'Micronaut', version: null, category: 'web', confidence: 0.9 });
        }
        if (content.includes('ktor')) {
          out.push({ name: 'Ktor', version: null, category: 'web', confidence: 0.9 });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PHP
  // ═══════════════════════════════════════════════════════════════════════

  private detectFromPhp(projectPath: string, out: FrameworkInfo[]): void {
    const composerPath = join(projectPath, 'composer.json');
    if (!existsSync(composerPath)) return;

    const content = this.safeReadFile(composerPath);
    try {
      const pkg = JSON.parse(content);
      const allDeps = { ...pkg.require, ...pkg['require-dev'] };
      for (const [name, version] of Object.entries(allDeps)) {
        const fwInfo = FrameworkDetector.FRAMEWORK_MAP[name];
        if (fwInfo) {
          const vStr = typeof version === 'string' ? version : '';
          const vMatch = vStr.match(/([0-9][0-9.]*)/);
          out.push({ name: fwInfo.name, version: vMatch?.[1] || null, category: fwInfo.category, confidence: 0.9 });
        }
      }
    } catch {
      // Invalid JSON
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Go
  // ═══════════════════════════════════════════════════════════════════════

  private detectFromGo(projectPath: string, out: FrameworkInfo[]): void {
    const goModPath = join(projectPath, 'go.mod');
    if (!existsSync(goModPath)) return;

    const content = this.safeReadFile(goModPath);
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(github\.com\/[^\s]+)/);
      if (match) {
        const modPath = match[1].toLowerCase();
        for (const [key, fwInfo] of Object.entries(FrameworkDetector.FRAMEWORK_MAP)) {
          if (modPath.includes(key.toLowerCase())) {
            out.push({ name: fwInfo.name, version: null, category: fwInfo.category, confidence: 0.9 });
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Ruby
  // ═══════════════════════════════════════════════════════════════════════

  private detectFromRuby(projectPath: string, out: FrameworkInfo[]): void {
    const gemfilePath = join(projectPath, 'Gemfile');
    if (!existsSync(gemfilePath)) return;

    const content = this.safeReadFile(gemfilePath);
    if (content.includes("'rails'") || content.includes('"rails"')) {
      const vMatch = content.match(/['"]rails['"],\s*['"]~?>\s*([0-9.]+)['"]/);
      out.push({ name: 'Ruby on Rails', version: vMatch?.[1] || null, category: 'web', confidence: 0.95 });
    }
    if (content.includes("'sinatra'") || content.includes('"sinatra"')) {
      out.push({ name: 'Sinatra', category: 'web', version: null, confidence: 0.9 });
    }
    if (content.includes("'rspec'") || content.includes('"rspec"')) {
      out.push({ name: 'RSpec', category: 'test', version: null, confidence: 0.9 });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Dart / Flutter
  // ═══════════════════════════════════════════════════════════════════════

  private detectFromDart(projectPath: string, out: FrameworkInfo[]): void {
    const pubspecPath = join(projectPath, 'pubspec.yaml');
    if (!existsSync(pubspecPath)) return;

    const content = this.safeReadFile(pubspecPath);
    if (content.includes('flutter:')) {
      out.push({ name: 'Flutter', version: null, category: 'web', confidence: 0.95 });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Rust
  // ═══════════════════════════════════════════════════════════════════════

  private detectFromRust(projectPath: string, out: FrameworkInfo[]): void {
    const cargoPath = join(projectPath, 'Cargo.toml');
    if (!existsSync(cargoPath)) return;

    const content = this.safeReadFile(cargoPath);
    for (const [key, fwInfo] of Object.entries(FrameworkDetector.FRAMEWORK_MAP)) {
      if (content.includes(`"${key}"`) || content.includes(`'${key}'`) || content.includes(`${key} =`)) {
        out.push({ name: fwInfo.name, version: null, category: fwInfo.category, confidence: 0.85 });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TOOLCHAIN DETECTION
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Detect build/test/lint/run commands based on project files.
   */
  private detectToolchain(
    projectPath: string,
    report: AnalysisReport,
    primaryFw: FrameworkInfo | null,
    allFrameworks: FrameworkInfo[],
  ): DetectedToolchain {
    const lang = report.projectInfo.primaryLanguages[0] || 'Unknown';
    const hasMakefile = existsSync(join(projectPath, 'Makefile'));
    const hasDockerCompose = existsSync(join(projectPath, 'docker-compose.yml')) || existsSync(join(projectPath, 'docker-compose.yaml'));

    const hasTest = (name: string) => allFrameworks.some(f => f.name === name);
    const hasLint = (name: string) => allFrameworks.some(f => f.name === name && f.category === 'lint');

    // Python
    if (lang === 'Python') {
      const fwName = primaryFw?.name || 'Python';
      const hasPytest = hasTest('pytest');
      const hasRuff = hasLint('Ruff');
      const hasPoetry = existsSync(join(projectPath, 'poetry.lock'));
      const hasPipenv = existsSync(join(projectPath, 'Pipfile.lock'));

      let runCmd = 'python -m main';
      if (fwName === 'FastAPI') runCmd = 'uvicorn app.main:app --reload';
      else if (fwName === 'Django') runCmd = 'python manage.py runserver';
      else if (fwName === 'Flask') runCmd = 'flask run --debug';

      let installCmd = 'pip install -r requirements.txt';
      if (hasPoetry) installCmd = 'poetry install';
      else if (hasPipenv) installCmd = 'pipenv install';

      return {
        buildCmd: hasMakefile ? 'make build' : (fwName === 'Django' ? 'python manage.py check' : 'python -m py_compile main.py'),
        testCmd: hasPytest ? 'pytest' : 'python -m unittest discover',
        lintCmd: hasRuff ? 'ruff check .' : (hasLint('Flake8') ? 'flake8 .' : (hasLint('Pylint') ? 'pylint src/' : 'ruff check .')),
        runCmd,
        coverageCmd: hasPytest ? 'pytest --cov' : 'coverage run -m pytest',
        installCmd,
        migrateCmd: fwName === 'Django' ? 'python manage.py migrate' : (fwName === 'FastAPI' ? 'alembic upgrade head' : null),
        depsFile: hasPoetry ? 'pyproject.toml' : (hasPipenv ? 'Pipfile' : 'requirements.txt'),
      };
    }

    // TypeScript / JavaScript
    if (lang === 'TypeScript' || lang === 'JavaScript') {
      const hasYarn = existsSync(join(projectPath, 'yarn.lock'));
      const hasPnpm = existsSync(join(projectPath, 'pnpm-lock.yaml'));
      const pm = hasPnpm ? 'pnpm' : (hasYarn ? 'yarn' : 'npm');

      return {
        buildCmd: `${pm} run build`,
        testCmd: hasTest('Vitest') ? `${pm} run test` : (hasTest('Jest') ? `${pm} test` : `${pm} test`),
        lintCmd: hasLint('Biome') ? `${pm} run lint` : (hasLint('ESLint') ? `${pm} run lint` : 'npx eslint .'),
        runCmd: `${pm} run dev`,
        coverageCmd: `${pm} run test -- --coverage`,
        installCmd: `${pm} install`,
        migrateCmd: primaryFw?.name === 'NestJS' ? 'npx typeorm migration:run' : null,
        depsFile: 'package.json',
      };
    }

    // Java / Kotlin
    if (lang === 'Java' || lang === 'Kotlin') {
      const hasMaven = existsSync(join(projectPath, 'pom.xml'));
      const hasGradle = existsSync(join(projectPath, 'build.gradle')) || existsSync(join(projectPath, 'build.gradle.kts'));

      if (hasMaven) {
        return {
          buildCmd: 'mvn clean package',
          testCmd: 'mvn test',
          lintCmd: 'mvn checkstyle:check',
          runCmd: 'mvn spring-boot:run',
          coverageCmd: 'mvn jacoco:report',
          installCmd: 'mvn install',
          migrateCmd: 'mvn flyway:migrate',
          depsFile: 'pom.xml',
        };
      }
      if (hasGradle) {
        return {
          buildCmd: './gradlew build',
          testCmd: './gradlew test',
          lintCmd: './gradlew check',
          runCmd: './gradlew bootRun',
          coverageCmd: './gradlew jacocoTestReport',
          installCmd: './gradlew dependencies',
          migrateCmd: './gradlew flywayMigrate',
          depsFile: existsSync(join(projectPath, 'build.gradle.kts')) ? 'build.gradle.kts' : 'build.gradle',
        };
      }
    }

    // PHP
    if (lang === 'PHP') {
      return {
        buildCmd: 'composer install --no-dev',
        testCmd: primaryFw?.name === 'Laravel' ? 'php artisan test' : 'vendor/bin/phpunit',
        lintCmd: 'vendor/bin/phpstan analyse',
        runCmd: primaryFw?.name === 'Laravel' ? 'php artisan serve' : 'php -S localhost:8000',
        coverageCmd: 'vendor/bin/phpunit --coverage-text',
        installCmd: 'composer install',
        migrateCmd: primaryFw?.name === 'Laravel' ? 'php artisan migrate' : null,
        depsFile: 'composer.json',
      };
    }

    // Go
    if (lang === 'Go') {
      return {
        buildCmd: 'go build ./...',
        testCmd: 'go test ./...',
        lintCmd: 'golangci-lint run',
        runCmd: 'go run .',
        coverageCmd: 'go test -coverprofile=coverage.out ./...',
        installCmd: 'go mod download',
        migrateCmd: null,
        depsFile: 'go.mod',
      };
    }

    // Ruby
    if (lang === 'Ruby') {
      return {
        buildCmd: 'bundle exec rake build',
        testCmd: hasTest('RSpec') ? 'bundle exec rspec' : 'bundle exec rake test',
        lintCmd: 'bundle exec rubocop',
        runCmd: primaryFw?.name === 'Ruby on Rails' ? 'rails server' : 'ruby app.rb',
        coverageCmd: 'bundle exec rspec --format documentation',
        installCmd: 'bundle install',
        migrateCmd: primaryFw?.name === 'Ruby on Rails' ? 'rails db:migrate' : null,
        depsFile: 'Gemfile',
      };
    }

    // Dart
    if (lang === 'Dart') {
      return {
        buildCmd: 'flutter build',
        testCmd: 'flutter test',
        lintCmd: 'dart analyze',
        runCmd: 'flutter run',
        coverageCmd: 'flutter test --coverage',
        installCmd: 'flutter pub get',
        migrateCmd: null,
        depsFile: 'pubspec.yaml',
      };
    }

    // Rust
    if (lang === 'Rust') {
      return {
        buildCmd: 'cargo build',
        testCmd: 'cargo test',
        lintCmd: 'cargo clippy',
        runCmd: 'cargo run',
        coverageCmd: 'cargo tarpaulin',
        installCmd: 'cargo build',
        migrateCmd: null,
        depsFile: 'Cargo.toml',
      };
    }

    // Fallback
    return {
      buildCmd: hasMakefile ? 'make build' : 'echo "No build command detected"',
      testCmd: hasMakefile ? 'make test' : 'echo "No test command detected"',
      lintCmd: hasMakefile ? 'make lint' : 'echo "No lint command detected"',
      runCmd: hasMakefile ? 'make run' : 'echo "No run command detected"',
      coverageCmd: 'echo "No coverage command detected"',
      installCmd: 'echo "No install command detected"',
      migrateCmd: null,
      depsFile: 'unknown',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PROJECT STRUCTURE DETECTION
  // ═══════════════════════════════════════════════════════════════════════

  private detectProjectStructure(report: AnalysisReport): 'clean-architecture' | 'mvc' | 'modular' | 'flat' | 'monorepo' | 'unknown' {
    const paths = report.dependencyGraph.nodes.map(n => n.toLowerCase());

    // Clean Architecture / DDD
    const hasDomain = paths.some(p => p.includes('/domain/'));
    const hasApplication = paths.some(p => p.includes('/application/'));
    const hasInfrastructure = paths.some(p => p.includes('/infrastructure/'));
    const hasPresentation = paths.some(p => p.includes('/presentation/'));
    if ((hasDomain && hasInfrastructure) || (hasDomain && hasApplication && hasPresentation)) {
      return 'clean-architecture';
    }

    // MVC
    const hasModels = paths.some(p => p.includes('/models/'));
    const hasViews = paths.some(p => p.includes('/views/'));
    const hasControllers = paths.some(p => p.includes('/controllers/'));
    if (hasModels && hasViews && hasControllers) return 'mvc';

    // Modular (NestJS, feature-based)
    const hasModules = paths.some(p => p.includes('/modules/'));
    const hasFeatures = paths.some(p => p.includes('/features/'));
    if (hasModules || hasFeatures) return 'modular';

    // Monorepo
    const hasPackages = paths.some(p => p.includes('/packages/'));
    const hasApps = paths.some(p => p.includes('/apps/'));
    if (hasPackages || hasApps) return 'monorepo';

    // Flat
    const maxDepth = Math.max(...paths.map(p => p.split('/').length));
    if (maxDepth <= 3) return 'flat';

    return 'unknown';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // UTILS
  // ═══════════════════════════════════════════════════════════════════════

  private safeReadFile(path: string): string {
    try {
      return readFileSync(path, 'utf-8');
    } catch {
      return '';
    }
  }
}
