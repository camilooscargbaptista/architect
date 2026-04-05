/**
 * Tests for Plugin Types — Fase 3.4
 *
 * Validates the plugin manifest spec and type contracts.
 */

import type {
  ArchitectPlugin,
  PluginManifest,
  PluginEntry,
  PluginContext,
  PluginSource,
  PluginSearchResult,
  ScoreModifierFn,
} from '../src/core/types/plugin.js';
import type { RefactorRule } from '../src/core/types/rules.js';

// ── Type Contract Tests ──────────────────────────────────────────

describe('Plugin Types — Type Contracts', () => {
  describe('PluginManifest', () => {
    it('should accept a minimal valid manifest', () => {
      const manifest: PluginManifest = {
        name: 'my-plugin',
        version: '1.0.0',
        description: 'A test plugin',
        hooks: {},
      };

      expect(manifest.name).toBe('my-plugin');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.hooks).toBeDefined();
    });

    it('should accept a full manifest with all optional fields', () => {
      const manifest: PluginManifest = {
        name: '@org/architect-plugin-react',
        version: '2.3.1',
        description: 'React-specific architecture rules',
        author: 'Girardelli Tecnologia',
        license: 'MIT',
        architectVersion: '>=9.0.0',
        keywords: ['react', 'architecture', 'components'],
        main: 'dist/index.js',
        hooks: {
          antiPatterns: true,
          refactorRules: true,
          scoreModifiers: false,
        },
      };

      expect(manifest.author).toBe('Girardelli Tecnologia');
      expect(manifest.keywords).toContain('react');
      expect(manifest.hooks.antiPatterns).toBe(true);
      expect(manifest.hooks.refactorRules).toBe(true);
    });
  });

  describe('ArchitectPlugin', () => {
    it('should accept a minimal plugin with just name and version', () => {
      const plugin: ArchitectPlugin = {
        name: 'simple',
        version: '0.1.0',
      };

      expect(plugin.name).toBe('simple');
      expect(plugin.detectAntiPatterns).toBeUndefined();
      expect(plugin.refactorRules).toBeUndefined();
    });

    it('should accept a plugin with refactor rules', () => {
      const rule: RefactorRule = {
        name: 'test-rule',
        tier: 2,
        analyze: () => [],
      };

      const plugin: ArchitectPlugin = {
        name: 'rule-provider',
        version: '1.0.0',
        refactorRules: [rule],
      };

      expect(plugin.refactorRules).toHaveLength(1);
      expect(plugin.refactorRules![0]!.name).toBe('test-rule');
    });

    it('should accept a plugin with lifecycle hooks', async () => {
      let activated = false;
      let deactivated = false;

      const plugin: ArchitectPlugin = {
        name: 'lifecycle-plugin',
        version: '1.0.0',
        activate: async (_ctx: PluginContext) => { activated = true; },
        deactivate: async () => { deactivated = true; },
      };

      await plugin.activate!({ projectPath: '/test', config: {} });
      await plugin.deactivate!();
      expect(activated).toBe(true);
      expect(deactivated).toBe(true);
    });

    it('should accept a plugin with score modifier', () => {
      const modifier: ScoreModifierFn = (breakdown, _ctx) => {
        return { ...breakdown, customMetric: 85 };
      };

      const plugin: ArchitectPlugin = {
        name: 'score-plugin',
        version: '1.0.0',
        modifyScore: modifier,
      };

      expect(plugin.modifyScore).toBeDefined();
    });
  });

  describe('PluginEntry', () => {
    it('should represent a local plugin entry', () => {
      const entry: PluginEntry = {
        name: 'local-rule',
        version: '1.0.0',
        source: 'local',
        resolvedPath: '/home/user/project/plugins/local-rule',
        enabled: true,
      };

      expect(entry.source).toBe('local');
      expect(entry.manifest).toBeUndefined();
    });

    it('should represent an npm plugin entry with manifest', () => {
      const entry: PluginEntry = {
        name: 'architect-plugin-react',
        version: '2.0.0',
        source: 'npm',
        resolvedPath: '/project/.architect/plugins/node_modules/architect-plugin-react',
        enabled: true,
        manifest: {
          name: 'architect-plugin-react',
          version: '2.0.0',
          description: 'React architecture rules',
          hooks: { refactorRules: true },
        },
      };

      expect(entry.source).toBe('npm');
      expect(entry.manifest!.hooks.refactorRules).toBe(true);
    });
  });

  describe('PluginSource', () => {
    it('should accept valid source types', () => {
      const sources: PluginSource[] = ['local', 'npm', 'git'];
      expect(sources).toHaveLength(3);
    });
  });

  describe('PluginSearchResult', () => {
    it('should represent a search result', () => {
      const result: PluginSearchResult = {
        name: 'architect-plugin-monorepo',
        version: '3.1.0',
        description: 'Monorepo-specific architecture rules',
        keywords: ['monorepo', 'workspaces'],
        author: 'Community',
        downloads: 15000,
      };

      expect(result.name).toBe('architect-plugin-monorepo');
      expect(result.downloads).toBe(15000);
    });
  });
});
