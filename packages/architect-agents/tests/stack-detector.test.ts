import { StackDetector } from '../src/core/agent-generator/stack-detector.js';
import { AnalysisReport } from '@girardelli/architect-core/src/core/types/core.js';

function makeReport(nodes: string[], frameworks: string[] = []): AnalysisReport {
  return {
    timestamp: new Date().toISOString(),
    projectInfo: {
      path: '/test',
      name: 'test-project',
      frameworks,
      totalFiles: nodes.length,
      totalLines: 1000,
      primaryLanguages: [],
    },
    score: {
      overall: 75,
      components: [],
      breakdown: { modularity: 80, coupling: 70, cohesion: 75, layering: 75 },
    },
    antiPatterns: [],
    layers: [],
    dependencyGraph: { nodes, edges: [] },
    suggestions: [],
    diagram: { mermaid: '', type: 'layer' },
  };
}

describe('StackDetector', () => {
  const detector = new StackDetector();

  describe('Language Detection', () => {
    it('should detect TypeScript from .ts files', () => {
      const report = makeReport(['src/app.ts', 'src/index.ts']);
      const stack = detector.detect(report);

      expect(stack.languages).toContain('TypeScript');
      expect(stack.primary).toBe('TypeScript');
    });

    it('should detect Python from .py files', () => {
      const report = makeReport(['src/main.py', 'src/utils.py']);
      const stack = detector.detect(report);

      expect(stack.languages).toContain('Python');
      expect(stack.primary).toBe('Python');
    });

    it('should detect Dart from .dart files', () => {
      const report = makeReport(['lib/main.dart', 'lib/app.dart']);
      const stack = detector.detect(report);

      expect(stack.languages).toContain('Dart');
      expect(stack.primary).toBe('Dart');
    });

    it('should detect Go from .go files', () => {
      const report = makeReport(['main.go', 'handler.go', 'go.mod']);
      const stack = detector.detect(report);

      expect(stack.languages).toContain('Go');
    });

    it('should detect multiple languages', () => {
      const report = makeReport(['src/app.ts', 'scripts/build.py']);
      const stack = detector.detect(report);

      expect(stack.languages).toContain('TypeScript');
      expect(stack.languages).toContain('Python');
    });

    it('should return Unknown for unrecognized extensions', () => {
      const report = makeReport(['file.xyz', 'data.abc']);
      const stack = detector.detect(report);

      expect(stack.primary).toBe('Unknown');
      expect(stack.languages).toHaveLength(0);
    });
  });

  describe('Framework Detection', () => {
    it('should detect NestJS from projectInfo.frameworks', () => {
      const report = makeReport(['src/app.module.ts', 'src/users/users.service.ts'], ['NestJS']);
      const stack = detector.detect(report);

      expect(stack.frameworks).toContain('NestJS');
    });

    it('should detect Angular from projectInfo.frameworks', () => {
      const report = makeReport(['src/app/app.component.ts', 'src/app/app.module.ts'], ['Angular']);
      const stack = detector.detect(report);

      expect(stack.frameworks).toContain('Angular');
    });

    it('should detect Django from projectInfo.frameworks', () => {
      const report = makeReport(['manage.py', 'app/views.py', 'app/models.py'], ['Django']);
      const stack = detector.detect(report);

      expect(stack.frameworks).toContain('Django');
    });

    it('should detect Flutter from projectInfo.frameworks', () => {
      const report = makeReport(['lib/main.dart', 'lib/app.dart'], ['Flutter']);
      const stack = detector.detect(report);

      expect(stack.frameworks).toContain('Flutter');
    });

    it('should detect Spring Boot from projectInfo.frameworks', () => {
      const report = makeReport(['pom.xml', 'src/main/java/App.java'], ['Spring Boot']);
      const stack = detector.detect(report);

      expect(stack.frameworks).toContain('Spring Boot');
    });

    it('should detect Next.js from projectInfo.frameworks', () => {
      const report = makeReport(['src/pages/index.tsx', 'next.config.js'], ['Next.js']);
      const stack = detector.detect(report);

      expect(stack.frameworks).toContain('Next.js');
    });

    it('should detect Vue from projectInfo.frameworks', () => {
      const report = makeReport(['src/App.vue', 'src/components/Header.vue'], ['Vue']);
      const stack = detector.detect(report);

      expect(stack.frameworks).toContain('Vue');
    });
  });

  describe('Derived Properties', () => {
    it('should set hasBackend true for TypeScript projects', () => {
      const report = makeReport(['src/app.ts', 'src/controller.ts']);
      const stack = detector.detect(report);

      expect(stack.hasBackend).toBe(true);
    });

    it('should set hasFrontend true for Angular projects', () => {
      const report = makeReport(['src/app.component.ts', 'src/app.module.ts'], ['Angular']);
      const stack = detector.detect(report);

      expect(stack.hasFrontend).toBe(true);
    });

    it('should set hasMobile true for Dart projects', () => {
      const report = makeReport(['lib/main.dart']);
      const stack = detector.detect(report);

      expect(stack.hasMobile).toBe(true);
    });

    it('should set hasDatabase true when migration files exist', () => {
      const report = makeReport(['src/app.ts', 'src/migration/001_init.ts']);
      const stack = detector.detect(report);

      expect(stack.hasDatabase).toBe(true);
    });

    it('should set hasDatabase true when entity files exist', () => {
      const report = makeReport(['src/app.ts', 'src/entity/user.entity.ts']);
      const stack = detector.detect(report);

      expect(stack.hasDatabase).toBe(true);
    });

    it('should set hasDatabase false when no DB-related patterns', () => {
      const report = makeReport(['src/app.ts', 'src/utils.ts']);
      const stack = detector.detect(report);

      expect(stack.hasDatabase).toBe(false);
    });
  });

  describe('Test Framework Detection', () => {
    it('should return pytest for Python', () => {
      const report = makeReport(['src/main.py']);
      const stack = detector.detect(report);

      expect(stack.testFramework).toBe('pytest');
    });

    it('should return flutter_test for Dart', () => {
      const report = makeReport(['lib/main.dart']);
      const stack = detector.detect(report);

      expect(stack.testFramework).toBe('flutter_test');
    });

    it('should return Jest for TypeScript (non-Angular)', () => {
      const report = makeReport(['src/app.ts']);
      const stack = detector.detect(report);

      expect(stack.testFramework).toBe('Jest');
    });

    it('should return Jest + Jasmine for Angular', () => {
      const report = makeReport(['src/app.component.ts'], ['Angular']);
      const stack = detector.detect(report);

      expect(stack.testFramework).toBe('Jest + Jasmine');
    });

    it('should return go test for Go', () => {
      const report = makeReport(['main.go']);
      const stack = detector.detect(report);

      expect(stack.testFramework).toBe('go test');
    });
  });

  describe('Package Manager Detection', () => {
    it('should return pip for Python', () => {
      const report = makeReport(['src/main.py']);
      const stack = detector.detect(report);

      expect(stack.packageManager).toBe('pip');
    });

    it('should return npm for TypeScript', () => {
      const report = makeReport(['src/app.ts']);
      const stack = detector.detect(report);

      expect(stack.packageManager).toBe('npm');
    });

    it('should return pub for Dart', () => {
      const report = makeReport(['lib/main.dart']);
      const stack = detector.detect(report);

      expect(stack.packageManager).toBe('pub');
    });

    it('should return cargo for Rust', () => {
      const report = makeReport(['src/main.rs', 'Cargo.toml']);
      const stack = detector.detect(report);

      expect(stack.packageManager).toBe('cargo');
    });
  });
});
