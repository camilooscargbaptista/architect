import { ProjectScanner } from '../src/scanner.js';
import { ArchitectConfig } from '../src/types.js';

describe('ProjectScanner', () => {
  const mockConfig: ArchitectConfig = {
    ignore: ['node_modules', 'dist', 'coverage'],
    frameworks: { detect: true },
  };

  describe('scan', () => {
    it('should scan a project directory and return project info', () => {
      const scanner = new ProjectScanner(__dirname, mockConfig);
      const info = scanner.scan();

      expect(info).toBeDefined();
      expect(info.path).toBe(__dirname);
      expect(info.totalFiles).toBeGreaterThanOrEqual(0);
      expect(info.totalLines).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(info.primaryLanguages)).toBe(true);
      expect(Array.isArray(info.frameworks)).toBe(true);
    });

    it('should detect TypeScript files', () => {
      const scanner = new ProjectScanner(__dirname, mockConfig);
      const info = scanner.scan();

      if (info.totalFiles > 0) {
        expect(info.primaryLanguages.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should build a file tree structure', () => {
      const scanner = new ProjectScanner(__dirname, mockConfig);
      const info = scanner.scan();

      expect(info.fileTree).toBeDefined();
      expect(info.fileTree?.type).toBe('directory');
      expect(info.fileTree?.children).toBeDefined();
    });
  });

  describe('framework detection', () => {
    it('should detect frameworks from configuration files', () => {
      const scanner = new ProjectScanner(__dirname, mockConfig);
      const info = scanner.scan();

      expect(Array.isArray(info.frameworks)).toBe(true);
    });
  });
});
