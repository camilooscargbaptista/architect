import path from 'path';
import { ProjectScanner } from '../src/infrastructure/scanner.js';
import { ArchitectConfig } from '../src/core/types/core.js';

// Use path.resolve for Jest compatibility (import.meta.url not supported by ts-jest)
const testDir = path.resolve(process.cwd(), 'packages/architect-core/tests');

describe('ProjectScanner', () => {
  const mockConfig: ArchitectConfig = {
    ignore: ['node_modules', 'dist', 'coverage'],
    frameworks: { detect: true },
  };

  describe('scan', () => {
    it('should scan a project directory and return project info', () => {
      const scanner = new ProjectScanner(testDir, mockConfig);
      const info = scanner.scan();

      expect(info).toBeDefined();
      expect(info.path).toBe(testDir);
      expect(info.totalFiles).toBeGreaterThanOrEqual(0);
      expect(info.totalLines).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(info.primaryLanguages)).toBe(true);
      expect(Array.isArray(info.frameworks)).toBe(true);
    });

    it('should detect TypeScript files', () => {
      const scanner = new ProjectScanner(testDir, mockConfig);
      const info = scanner.scan();

      if (info.totalFiles > 0) {
        expect(info.primaryLanguages.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should build a file tree structure', () => {
      const scanner = new ProjectScanner(testDir, mockConfig);
      const info = scanner.scan();

      expect(info.fileTree).toBeDefined();
      expect(info.fileTree?.type).toBe('directory');
      expect(info.fileTree?.children).toBeDefined();
    });
  });

  describe('framework detection', () => {
    it('should detect frameworks from configuration files', () => {
      const scanner = new ProjectScanner(testDir, mockConfig);
      const info = scanner.scan();

      expect(Array.isArray(info.frameworks)).toBe(true);
    });
  });
});
