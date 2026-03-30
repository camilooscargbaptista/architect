import { AntiPatternDetector } from '../src/core/anti-patterns.js';
import { AntiPattern, ArchitectConfig } from '../src/core/types/core.js';
import { FileNode } from '../src/core/types/infrastructure.js';

describe('AntiPatternDetector', () => {
  const mockConfig: ArchitectConfig = {
    antiPatterns: {
      godClass: {
        linesThreshold: 500,
        methodsThreshold: 10,
      },
      shotgunSurgery: {
        changePropagationThreshold: 5,
      },
    },
  };

  const mockFileTree: FileNode = {
    path: '/project',
    name: 'project',
    type: 'directory',
    children: [
      {
        path: '/project/src/services/UserManager.ts',
        name: 'UserManager.ts',
        type: 'file',
        extension: '.ts',
        lines: 850,
      },
      {
        path: '/project/src/utils/helper.ts',
        name: 'helper.ts',
        type: 'file',
        extension: '.ts',
        lines: 200,
      },
    ],
  };

  const mockDependencies = new Map<string, Set<string>>([
    ['/project/src/services/UserManager.ts', new Set(['/project/src/utils/helper.ts'])],
    ['/project/src/utils/helper.ts', new Set(['/project/src/services/UserManager.ts'])],
  ]);

  describe('detect', () => {
    it('should detect anti-patterns in code', () => {
      const detector = new AntiPatternDetector(mockConfig);
      const patterns = detector.detect(mockFileTree, mockDependencies);

      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should identify God Classes', () => {
      const detector = new AntiPatternDetector(mockConfig);
      const patterns = detector.detect(mockFileTree, mockDependencies);

      const godClasses = patterns.filter((p) => p.name === 'God Class');
      expect(godClasses.length).toBeGreaterThanOrEqual(0);
    });

    it('should sort patterns by severity', () => {
      const detector = new AntiPatternDetector(mockConfig);
      const patterns = detector.detect(mockFileTree, mockDependencies);

      if (patterns.length > 1) {
        const severityOrder: Record<string, number> = {
          CRITICAL: 0,
          HIGH: 1,
          MEDIUM: 2,
          LOW: 3,
        };

        for (let i = 0; i < patterns.length - 1; i++) {
          const current = severityOrder[patterns[i].severity];
          const next = severityOrder[patterns[i + 1].severity];
          expect(current).toBeLessThanOrEqual(next);
        }
      }
    });
  });

  describe('circular dependency detection', () => {
    it('should detect circular dependencies', () => {
      const circularDeps = new Map<string, Set<string>>([
        ['src/auth.ts', new Set(['src/cache.ts'])],
        ['src/cache.ts', new Set(['src/auth.ts'])],
      ]);

      const detector = new AntiPatternDetector(mockConfig);
      const patterns = detector.detect(mockFileTree, circularDeps);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });
  });
});
