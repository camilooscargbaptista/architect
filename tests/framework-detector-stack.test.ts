import { FrameworkDetector } from '../src/agent-generator/framework-detector.js';
import { AnalysisReport } from '../src/types.js';

/**
 * Tests for FrameworkDetector.detectStack() — the consolidated replacement
 * for the old StackDetector. This focuses on the derived properties
 * (hasBackend/hasFrontend/hasMobile/hasDatabase), package manager and test
 * framework fallbacks. Framework detection from dependency files is covered
 * in framework-detector.test.ts.
 */
function makeReport(nodes: string[], primaryLanguages: string[] = []): AnalysisReport {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      path: '/test',
      name: 'test-project',
      frameworks: [],
      totalFiles: nodes.length,
      totalLines: 1000,
      primaryLanguages,
    },
    score: {
      overall: 75,
      overallBand: 'attention',
      components: [],
      breakdown: { modularity: 80, coupling: 70, cohesion: 75, layering: 75 },
      bands: { modularity: 'solid', coupling: 'attention', cohesion: 'solid', layering: 'solid' },
    },
    antiPatterns: [],
    layers: [],
    dependencyGraph: { nodes, edges: [] },
    suggestions: [],
    diagram: { mermaid: '', type: 'layer' },
  };
}

describe('FrameworkDetector.detectStack', () => {
  const detector = new FrameworkDetector();
  const nowhere = '/tmp/__architect_non_existent__';

  describe('Language Detection (from primaryLanguages)', () => {
    it('should detect TypeScript when report says so', () => {
      const stack = detector.detectStack(makeReport(['src/app.ts'], ['TypeScript']), nowhere);
      expect(stack.languages).toContain('TypeScript');
      expect(stack.primary).toBe('TypeScript');
    });

    it('should detect Python when report says so', () => {
      const stack = detector.detectStack(makeReport(['src/main.py'], ['Python']), nowhere);
      expect(stack.languages).toContain('Python');
      expect(stack.primary).toBe('Python');
    });

    it('should detect Dart when report says so', () => {
      const stack = detector.detectStack(makeReport(['lib/main.dart'], ['Dart']), nowhere);
      expect(stack.languages).toContain('Dart');
      expect(stack.primary).toBe('Dart');
    });

    it('should canonicalise Java/Kotlin into a single bucket', () => {
      const stack = detector.detectStack(makeReport(['App.kt'], ['Kotlin']), nowhere);
      expect(stack.languages).toContain('Java/Kotlin');
      expect(stack.primary).toBe('Java/Kotlin');
    });

    it('should detect multiple languages', () => {
      const stack = detector.detectStack(
        makeReport(['src/app.ts', 'scripts/build.py'], ['TypeScript', 'Python']),
        nowhere,
      );
      expect(stack.languages).toContain('TypeScript');
      expect(stack.languages).toContain('Python');
    });

    it('should return Unknown when no languages are detected', () => {
      const stack = detector.detectStack(makeReport(['file.xyz']), nowhere);
      expect(stack.primary).toBe('Unknown');
      expect(stack.languages).toHaveLength(0);
    });
  });

  describe('Framework Fallbacks (file-tree hints)', () => {
    it('should detect Vue from .vue files in the tree', () => {
      const stack = detector.detectStack(
        makeReport(['src/App.vue', 'src/components/Header.vue'], ['TypeScript']),
        nowhere,
      );
      expect(stack.frameworks).toContain('Vue');
    });

    it('should detect Flutter from .dart files in the tree', () => {
      const stack = detector.detectStack(
        makeReport(['lib/main.dart'], ['Dart']),
        nowhere,
      );
      expect(stack.frameworks).toContain('Flutter');
    });

    it('should detect Go Modules from go.mod in the tree', () => {
      const stack = detector.detectStack(
        makeReport(['main.go', 'go.mod'], ['Go']),
        nowhere,
      );
      expect(stack.frameworks).toContain('Go Modules');
    });
  });

  describe('Derived Properties', () => {
    it('should set hasBackend true for TypeScript projects', () => {
      const stack = detector.detectStack(makeReport(['src/app.ts'], ['TypeScript']), nowhere);
      expect(stack.hasBackend).toBe(true);
    });

    it('should set hasBackend true for Python projects', () => {
      const stack = detector.detectStack(makeReport(['src/main.py'], ['Python']), nowhere);
      expect(stack.hasBackend).toBe(true);
    });

    it('should set hasFrontend true when .tsx files are present', () => {
      const stack = detector.detectStack(
        makeReport(['src/pages/index.tsx'], ['TypeScript']),
        nowhere,
      );
      expect(stack.hasFrontend).toBe(true);
    });

    it('should set hasMobile true for Dart/Flutter projects', () => {
      const stack = detector.detectStack(makeReport(['lib/main.dart'], ['Dart']), nowhere);
      expect(stack.hasMobile).toBe(true);
    });

    it('should set hasDatabase true when migration files exist', () => {
      const stack = detector.detectStack(
        makeReport(['src/app.ts', 'src/migration/001_init.ts'], ['TypeScript']),
        nowhere,
      );
      expect(stack.hasDatabase).toBe(true);
    });

    it('should set hasDatabase true when entity files exist', () => {
      const stack = detector.detectStack(
        makeReport(['src/app.ts', 'src/entity/user.entity.ts'], ['TypeScript']),
        nowhere,
      );
      expect(stack.hasDatabase).toBe(true);
    });

    it('should set hasDatabase false when no DB-related patterns exist', () => {
      const stack = detector.detectStack(
        makeReport(['src/app.ts', 'src/utils.ts'], ['TypeScript']),
        nowhere,
      );
      expect(stack.hasDatabase).toBe(false);
    });
  });

  describe('Test Framework Fallback', () => {
    it('should return pytest for Python', () => {
      const stack = detector.detectStack(makeReport(['src/main.py'], ['Python']), nowhere);
      expect(stack.testFramework).toBe('pytest');
    });

    it('should return flutter_test for Dart', () => {
      const stack = detector.detectStack(makeReport(['lib/main.dart'], ['Dart']), nowhere);
      expect(stack.testFramework).toBe('flutter_test');
    });

    it('should return Jest for plain TypeScript', () => {
      const stack = detector.detectStack(makeReport(['src/app.ts'], ['TypeScript']), nowhere);
      expect(stack.testFramework).toBe('Jest');
    });

    it('should return go test for Go', () => {
      const stack = detector.detectStack(makeReport(['main.go'], ['Go']), nowhere);
      expect(stack.testFramework).toBe('go test');
    });

    it('should return JUnit for Java/Kotlin', () => {
      const stack = detector.detectStack(makeReport(['App.java'], ['Java']), nowhere);
      expect(stack.testFramework).toBe('JUnit');
    });
  });

  describe('Package Manager Detection', () => {
    it('should return pip for Python', () => {
      const stack = detector.detectStack(makeReport(['src/main.py'], ['Python']), nowhere);
      expect(stack.packageManager).toBe('pip');
    });

    it('should return npm for TypeScript', () => {
      const stack = detector.detectStack(makeReport(['src/app.ts'], ['TypeScript']), nowhere);
      expect(stack.packageManager).toBe('npm');
    });

    it('should return pub for Dart', () => {
      const stack = detector.detectStack(makeReport(['lib/main.dart'], ['Dart']), nowhere);
      expect(stack.packageManager).toBe('pub');
    });

    it('should return cargo for Rust', () => {
      const stack = detector.detectStack(
        makeReport(['src/main.rs', 'Cargo.toml'], ['Rust']),
        nowhere,
      );
      expect(stack.packageManager).toBe('cargo');
    });

    it('should return gradle/maven for Java/Kotlin', () => {
      const stack = detector.detectStack(makeReport(['App.java'], ['Java']), nowhere);
      expect(stack.packageManager).toBe('gradle/maven');
    });
  });
});
