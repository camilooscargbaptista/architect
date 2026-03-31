import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';
import { StackInfo } from './types/stack.js';

/**
 * Detects the technology stack from an AnalysisReport.
 *
 * v5.1: Uses report.projectInfo.frameworks (precise, from scanner v5.0)
 * instead of naive string-matching on file paths.
 */
export class StackDetector {
  detect(report: AnalysisReport): StackInfo {
    const files = report.dependencyGraph.nodes;
    const extensions = new Set<string>();
    const languages = new Set<string>();
    const frameworks = new Set<string>();

    for (const file of files) {
      const ext = file.split('.').pop()?.toLowerCase() || '';
      extensions.add(ext);
    }

    // ── Language Detection ──
    if (extensions.has('py')) languages.add('Python');
    if (extensions.has('ts') || extensions.has('tsx')) languages.add('TypeScript');
    if (extensions.has('js') || extensions.has('jsx')) languages.add('JavaScript');
    if (extensions.has('dart')) languages.add('Dart');
    if (extensions.has('go')) languages.add('Go');
    if (extensions.has('rs')) languages.add('Rust');
    if (extensions.has('java') || extensions.has('kt')) languages.add('Java/Kotlin');
    if (extensions.has('rb')) languages.add('Ruby');
    if (extensions.has('php')) languages.add('PHP');
    if (extensions.has('cs')) languages.add('C#');

    // ── Framework Detection: Trust report.projectInfo.frameworks ──
    // These come from scanner v5.0 which reads actual package.json dependencies
    const reportFrameworks = report.projectInfo?.frameworks || [];
    for (const fw of reportFrameworks) {
      frameworks.add(fw);
    }

    // ── Derived Properties ──
    const primary = languages.size > 0 ? [...languages][0] : 'Unknown';

    // Frontend frameworks that indicate hasFrontend
    const FRONTEND_FRAMEWORKS = new Set([
      'Angular', 'Vue', 'Vue.js', 'Next.js', 'React', 'Nuxt', 'Nuxt.js',
      'Svelte', 'SvelteKit', 'Remix', 'Gatsby', 'Vite',
    ]);

    // Backend frameworks that indicate hasBackend (language-based is fallback)
    const BACKEND_FRAMEWORKS = new Set([
      'Express', 'Express.js', 'NestJS', 'Fastify', 'Koa', 'Hapi',
      'Django', 'Flask', 'FastAPI', 'Spring Boot', 'Laravel', 'Rails',
      'Ruby on Rails', 'Gin', 'Echo', 'Fiber', 'Actix Web', 'Rocket',
      'Probot', 'MCP SDK',
    ]);

    const MOBILE_FRAMEWORKS = new Set(['Flutter', 'React Native', 'Expo']);

    const hasBackend = [...frameworks].some(f => BACKEND_FRAMEWORKS.has(f)) ||
      languages.has('Python') || languages.has('TypeScript') ||
      languages.has('Go') || languages.has('Java/Kotlin') || languages.has('Ruby') ||
      languages.has('PHP') || languages.has('C#') || languages.has('Rust');

    const hasFrontend = [...frameworks].some(f => FRONTEND_FRAMEWORKS.has(f)) ||
      extensions.has('tsx') || extensions.has('jsx');

    const hasMobile = [...frameworks].some(f => MOBILE_FRAMEWORKS.has(f)) ||
      languages.has('Dart');

    const allFiles = files.join(' ').toLowerCase();
    const hasDatabase = allFiles.includes('migration') || allFiles.includes('entity') ||
      allFiles.includes('model') || allFiles.includes('schema') ||
      allFiles.includes('prisma') || allFiles.includes('typeorm');

    const testFramework = this.detectTestFramework(languages, frameworks);
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

  private detectTestFramework(languages: Set<string>, frameworks: Set<string>): string {
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
}
