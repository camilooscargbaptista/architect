import { ConfigLoader, normalizeIgnorePatterns } from '../src/core/config.js';
import { ArchitectConfig } from '../src/core/types/core.js';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('normalizeIgnorePatterns', () => {
  describe('simple directory names', () => {
    it('should expand simple names to all nesting levels', () => {
      const patterns = normalizeIgnorePatterns(['node_modules']);
      expect(patterns).toContain('node_modules');
      expect(patterns).toContain('node_modules/**');
      expect(patterns).toContain('**/node_modules');
      expect(patterns).toContain('**/node_modules/**');
    });

    it('should handle multiple simple names', () => {
      const patterns = normalizeIgnorePatterns(['node_modules', 'dist']);
      expect(patterns.length).toBe(8); // 4 patterns per name
      expect(patterns).toContain('node_modules');
      expect(patterns).toContain('dist');
      expect(patterns).toContain('dist/**');
      expect(patterns).toContain('**/dist/**');
    });

    it('should not duplicate patterns when given the same name twice', () => {
      const patterns = normalizeIgnorePatterns(['node_modules', 'node_modules']);
      // Set prevents duplicates
      expect(patterns.filter((p) => p === 'node_modules').length).toBe(1);
      expect(patterns.filter((p) => p === 'node_modules/**').length).toBe(1);
    });
  });

  describe('glob patterns', () => {
    it('should keep glob patterns with * unchanged', () => {
      const patterns = normalizeIgnorePatterns(['**/node_modules/**']);
      expect(patterns).toContain('**/node_modules/**');
      // Should only contain the pattern itself, not expanded
      expect(patterns.length).toBe(1);
    });

    it('should keep patterns with / unchanged', () => {
      const patterns = normalizeIgnorePatterns(['src/generated/**', 'build/dist']);
      expect(patterns).toContain('src/generated/**');
      expect(patterns).toContain('build/dist');
      expect(patterns.length).toBe(2);
    });

    it('should keep complex glob patterns unchanged', () => {
      const patterns = normalizeIgnorePatterns(['*.log', '**/*.tmp', 'out/**/*.js']);
      expect(patterns).toContain('*.log');
      expect(patterns).toContain('**/*.tmp');
      expect(patterns).toContain('out/**/*.js');
    });

    it('should handle mix of simple and glob patterns', () => {
      const patterns = normalizeIgnorePatterns(['node_modules', '**/*.tmp', 'dist']);
      expect(patterns).toContain('node_modules');
      expect(patterns).toContain('node_modules/**');
      expect(patterns).toContain('**/*.tmp');
      expect(patterns).toContain('dist');
      expect(patterns).toContain('dist/**');
    });
  });

  describe('edge cases', () => {
    it('should handle empty array', () => {
      const patterns = normalizeIgnorePatterns([]);
      expect(patterns).toEqual([]);
    });

    it('should handle single character names', () => {
      const patterns = normalizeIgnorePatterns(['a']);
      expect(patterns).toContain('a');
      expect(patterns).toContain('a/**');
      expect(patterns).toContain('**/a');
      expect(patterns).toContain('**/a/**');
    });

    it('should handle names with dots', () => {
      const patterns = normalizeIgnorePatterns(['.next']);
      expect(patterns).toContain('.next');
      expect(patterns).toContain('.next/**');
      expect(patterns).toContain('**/.next');
      expect(patterns).toContain('**/.next/**');
    });

    it('should handle names with underscores and hyphens', () => {
      const patterns = normalizeIgnorePatterns(['node_modules', 'dist-old']);
      expect(patterns).toContain('node_modules');
      expect(patterns).toContain('dist-old');
    });
  });
});

describe('ConfigLoader', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'architect-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadConfig', () => {
    it('should return default config when file does not exist', () => {
      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.ignore).toBeDefined();
      expect(config.ignore).toContain('**/node_modules/**');
      expect(config.frameworks?.detect).toBe(true);
      expect(config.antiPatterns?.godClass?.linesThreshold).toBe(500);
      expect(config.antiPatterns?.godClass?.methodsThreshold).toBe(10);
      expect(config.antiPatterns?.shotgunSurgery?.changePropagationThreshold).toBe(5);
      expect(config.score?.modularity).toBe(0.4);
      expect(config.score?.coupling).toBe(0.25);
      expect(config.score?.cohesion).toBe(0.2);
      expect(config.score?.layering).toBe(0.15);
      expect(config.monorepo?.enabled).toBe(true);
      expect(config.monorepo?.treatPackagesAsModules).toBe(true);
    });

    it('should return default config when .architect.json is invalid JSON', () => {
      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, 'invalid json {]');

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.ignore).toBeDefined();
      expect(config.frameworks?.detect).toBe(true);
    });

    it('should merge user config with defaults', () => {
      const userConfig: ArchitectConfig = {
        ignore: ['custom-dir'],
        frameworks: {
          detect: false,
        },
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      // User config should override framework detection
      expect(config.frameworks?.detect).toBe(false);
      // Custom ignore patterns should be normalized
      expect(config.ignore).toContain('custom-dir');
      expect(config.ignore).toContain('custom-dir/**');
      // Other defaults should remain
      expect(config.antiPatterns?.godClass?.linesThreshold).toBe(500);
    });

    it('should preserve ignore patterns from user config', () => {
      const userConfig: ArchitectConfig = {
        ignore: ['my-build', '**/*.tmp'],
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      // Simple name should be expanded
      expect(config.ignore).toContain('my-build');
      expect(config.ignore).toContain('my-build/**');
      // Glob pattern should be kept as-is
      expect(config.ignore).toContain('**/*.tmp');
    });

    it('should handle partial user config', () => {
      const userConfig: ArchitectConfig = {
        antiPatterns: {
          godClass: {
            linesThreshold: 1000,
          },
        },
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      // User override
      expect(config.antiPatterns?.godClass?.linesThreshold).toBe(1000);
      // Default preserved
      expect(config.antiPatterns?.godClass?.methodsThreshold).toBe(10);
    });

    it('should merge score weights correctly', () => {
      const userConfig: ArchitectConfig = {
        score: {
          modularity: 0.5,
          coupling: 0.3,
        },
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.score?.modularity).toBe(0.5);
      expect(config.score?.coupling).toBe(0.3);
      expect(config.score?.cohesion).toBe(0.2); // default
      expect(config.score?.layering).toBe(0.15); // default
    });

    it('should handle plugins array', () => {
      const userConfig: ArchitectConfig = {
        plugins: ['plugin-1', 'plugin-2'],
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.plugins).toEqual(['plugin-1', 'plugin-2']);
    });

    it('should use default plugins when not specified', () => {
      const userConfig: ArchitectConfig = {
        frameworks: { detect: false },
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.plugins).toEqual([]);
    });

    it('should handle monorepo configuration', () => {
      const userConfig: ArchitectConfig = {
        monorepo: {
          enabled: false,
          treatPackagesAsModules: false,
        },
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.monorepo?.enabled).toBe(false);
      expect(config.monorepo?.treatPackagesAsModules).toBe(false);
    });

    it('should handle scoring profile', () => {
      const userConfig: ArchitectConfig = {
        scoringProfile: 'microservices',
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.scoringProfile).toBe('microservices');
    });

    it('should preserve scoring profile default', () => {
      const userConfig: ArchitectConfig = {
        ignore: ['node_modules'],
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.scoringProfile).toBe('auto');
    });

    it('should merge antiPatterns.shotgunSurgery correctly', () => {
      const userConfig: ArchitectConfig = {
        antiPatterns: {
          shotgunSurgery: {
            changePropagationThreshold: 10,
          },
        },
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.antiPatterns?.shotgunSurgery?.changePropagationThreshold).toBe(10);
      expect(config.antiPatterns?.godClass?.linesThreshold).toBe(500); // preserved
    });

    it('should handle empty object config', () => {
      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify({}));

      const config = ConfigLoader.loadConfig(tempDir);

      // Should have all defaults
      expect(config.frameworks?.detect).toBe(true);
      expect(config.ignore).toBeDefined();
      expect(config.antiPatterns).toBeDefined();
    });

    it('should handle config with all properties set', () => {
      const userConfig: ArchitectConfig = {
        ignore: ['custom'],
        frameworks: { detect: false },
        antiPatterns: {
          godClass: { linesThreshold: 600, methodsThreshold: 20 },
          shotgunSurgery: { changePropagationThreshold: 7 },
        },
        score: {
          modularity: 0.3,
          coupling: 0.3,
          cohesion: 0.2,
          layering: 0.2,
        },
        scoringProfile: 'backend-monolith',
        monorepo: { enabled: false, treatPackagesAsModules: false },
        plugins: ['auth', 'logging'],
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      expect(config.frameworks?.detect).toBe(false);
      expect(config.antiPatterns?.godClass?.linesThreshold).toBe(600);
      expect(config.antiPatterns?.godClass?.methodsThreshold).toBe(20);
      expect(config.antiPatterns?.shotgunSurgery?.changePropagationThreshold).toBe(7);
      expect(config.score?.modularity).toBe(0.3);
      expect(config.scoringProfile).toBe('backend-monolith');
      expect(config.monorepo?.enabled).toBe(false);
      expect(config.plugins).toEqual(['auth', 'logging']);
    });

    it('should normalize ignore patterns from user config', () => {
      const userConfig: ArchitectConfig = {
        ignore: ['build', '**/cache/**'],
      };

      const configPath = join(tempDir, '.architect.json');
      writeFileSync(configPath, JSON.stringify(userConfig));

      const config = ConfigLoader.loadConfig(tempDir);

      // build should be expanded
      expect(config.ignore).toContain('build');
      expect(config.ignore).toContain('build/**');
      expect(config.ignore).toContain('**/build');
      expect(config.ignore).toContain('**/build/**');
      // glob pattern should be kept
      expect(config.ignore).toContain('**/cache/**');
    });
  });
});
