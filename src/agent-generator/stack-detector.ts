import { AnalysisReport } from '../types.js';
import { StackInfo } from './types.js';

/**
 * Detects the technology stack from an AnalysisReport.
 * Extracted from the monolithic AgentGenerator for single-responsibility.
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

    // ── Framework Detection from file patterns ──
    const allFiles = files.join(' ');
    if (allFiles.includes('manage.py') || allFiles.includes('django')) frameworks.add('Django');
    if (allFiles.includes('flask') || allFiles.includes('app.py')) frameworks.add('Flask');
    if (allFiles.includes('fastapi')) frameworks.add('FastAPI');
    if (allFiles.includes('.module.ts') || allFiles.includes('nest')) frameworks.add('NestJS');
    if (allFiles.includes('.component.ts') || allFiles.includes('angular')) frameworks.add('Angular');
    if (allFiles.includes('.vue')) frameworks.add('Vue');
    if (allFiles.includes('.tsx') && allFiles.includes('next')) frameworks.add('Next.js');
    if (allFiles.includes('.dart')) frameworks.add('Flutter');
    if (allFiles.includes('go.mod')) frameworks.add('Go Modules');
    if (allFiles.includes('Cargo.toml')) frameworks.add('Cargo');
    if (allFiles.includes('pom.xml') || allFiles.includes('build.gradle')) frameworks.add('Spring');
    if (allFiles.includes('rails') || allFiles.includes('Gemfile')) frameworks.add('Rails');
    if (allFiles.includes('laravel') || allFiles.includes('artisan')) frameworks.add('Laravel');

    // ── Derived Properties ──
    const primary = languages.size > 0 ? [...languages][0] : 'Unknown';

    const hasBackend = languages.has('Python') || languages.has('TypeScript') ||
      languages.has('Go') || languages.has('Java/Kotlin') || languages.has('Ruby') ||
      languages.has('PHP') || languages.has('C#') || languages.has('Rust');

    const hasFrontend = frameworks.has('Angular') || frameworks.has('Vue') ||
      frameworks.has('Next.js') || frameworks.has('React') || extensions.has('html');

    const hasMobile = languages.has('Dart') || frameworks.has('Flutter');

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
