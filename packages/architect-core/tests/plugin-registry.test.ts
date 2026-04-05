/**
 * Tests for PluginRegistry — Fase 3.4
 *
 * Covers plugin registration, loading, discovery, enable/disable,
 * rule integration, and lifecycle management.
 */

import { PluginRegistry } from '../src/core/plugin-registry.js';
import type { PluginEntry, PluginManifest } from '../src/core/types/plugin.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// ── Helpers ──────────────────────────────────────────────────────

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'architect-plugin-test-'));
}

function writeManifest(dir: string, manifest: PluginManifest): void {
  fs.writeFileSync(
    path.join(dir, 'architect-plugin.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8',
  );
}

function makeManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'A test plugin',
    hooks: { antiPatterns: false, refactorRules: true, scoreModifiers: false },
    ...overrides,
  };
}

function makePluginEntry(overrides?: Partial<PluginEntry>): PluginEntry {
  return {
    name: 'test-plugin',
    version: '1.0.0',
    source: 'local',
    resolvedPath: '/tmp/fake',
    enabled: true,
    ...overrides,
  };
}

// ── Cleanup ─────────────────────────────────────────────────────

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
});

// ── Tests ────────────────────────────────────────────────────────

describe('PluginRegistry', () => {
  describe('persistence (load/save)', () => {
    it('should save and load registry entries', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      // Create registry and add an entry manually
      const registry1 = new PluginRegistry(tmpDir);
      (registry1 as any).entries.set('my-plugin', makePluginEntry({
        name: 'my-plugin',
        version: '2.0.0',
      }));
      registry1.save();

      // Load in a new instance
      const registry2 = new PluginRegistry(tmpDir);
      registry2.load();

      const entry = registry2.get('my-plugin');
      expect(entry).toBeDefined();
      expect(entry!.name).toBe('my-plugin');
      expect(entry!.version).toBe('2.0.0');
    });

    it('should handle missing registry file gracefully', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      registry.load(); // should not throw
      expect(registry.list()).toEqual([]);
    });

    it('should handle corrupt registry file gracefully', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const regDir = path.join(tmpDir, '.architect');
      fs.mkdirSync(regDir, { recursive: true });
      fs.writeFileSync(path.join(regDir, 'plugin-registry.json'), '{{invalid json', 'utf-8');

      const registry = new PluginRegistry(tmpDir);
      registry.load(); // should not throw
      expect(registry.list()).toEqual([]);
    });
  });

  describe('list / get / has', () => {
    it('should list all registered plugins', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).entries.set('a', makePluginEntry({ name: 'a' }));
      (registry as any).entries.set('b', makePluginEntry({ name: 'b' }));

      expect(registry.list()).toHaveLength(2);
      expect(registry.has('a')).toBe(true);
      expect(registry.has('c')).toBe(false);
      expect(registry.get('a')?.name).toBe('a');
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('installLocal', () => {
    it('should install a plugin from a local path with manifest', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      // Create a fake plugin directory
      const pluginDir = path.join(tmpDir, 'my-local-plugin');
      fs.mkdirSync(pluginDir, { recursive: true });
      writeManifest(pluginDir, makeManifest({
        name: 'my-local-plugin',
        version: '3.0.0',
        description: 'Local test plugin',
      }));

      const registry = new PluginRegistry(tmpDir);
      const entry = registry.installLocal(pluginDir);

      expect(entry.name).toBe('my-local-plugin');
      expect(entry.version).toBe('3.0.0');
      expect(entry.source).toBe('local');
      expect(entry.enabled).toBe(true);
      expect(entry.manifest).toBeDefined();
      expect(entry.manifest!.description).toBe('Local test plugin');

      // Should be persisted
      expect(registry.has('my-local-plugin')).toBe(true);
    });

    it('should install a plugin without manifest using directory name', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const pluginDir = path.join(tmpDir, 'unnamed-plugin');
      fs.mkdirSync(pluginDir, { recursive: true });
      // No manifest file

      const registry = new PluginRegistry(tmpDir);
      const entry = registry.installLocal(pluginDir);

      expect(entry.name).toBe('unnamed-plugin');
      expect(entry.version).toBe('0.0.0');
    });

    it('should throw for non-existent path', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      expect(() => registry.installLocal('/nonexistent/path')).toThrow('Plugin path not found');
    });
  });

  describe('uninstall', () => {
    it('should remove a registered plugin', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).entries.set('doomed', makePluginEntry({ name: 'doomed' }));
      expect(registry.has('doomed')).toBe(true);

      const removed = registry.uninstall('doomed');
      expect(removed).toBe(true);
      expect(registry.has('doomed')).toBe(false);
    });

    it('should return false for non-existent plugin', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      expect(registry.uninstall('nonexistent')).toBe(false);
    });
  });

  describe('setEnabled', () => {
    it('should enable and disable a plugin', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).entries.set('toggle-me', makePluginEntry({ name: 'toggle-me', enabled: true }));

      expect(registry.setEnabled('toggle-me', false)).toBe(true);
      expect(registry.get('toggle-me')!.enabled).toBe(false);

      expect(registry.setEnabled('toggle-me', true)).toBe(true);
      expect(registry.get('toggle-me')!.enabled).toBe(true);
    });

    it('should return false for non-existent plugin', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      expect(registry.setEnabled('ghost', true)).toBe(false);
    });
  });

  describe('discover', () => {
    it('should discover plugins in .architect/plugins/node_modules', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      // Create a fake npm plugin
      const pluginPkg = path.join(tmpDir, '.architect', 'plugins', 'node_modules', 'architect-plugin-test');
      fs.mkdirSync(pluginPkg, { recursive: true });
      writeManifest(pluginPkg, makeManifest({
        name: 'architect-plugin-test',
        version: '1.2.0',
      }));

      const registry = new PluginRegistry(tmpDir);
      const discovered = registry.discover();

      expect(discovered).toHaveLength(1);
      expect(discovered[0]!.name).toBe('architect-plugin-test');
      expect(discovered[0]!.version).toBe('1.2.0');
      expect(discovered[0]!.source).toBe('npm');
      expect(discovered[0]!.enabled).toBe(false); // discovered but not yet enabled
    });

    it('should discover scoped packages', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const scopedPkg = path.join(tmpDir, '.architect', 'plugins', 'node_modules', '@myorg', 'architect-rule');
      fs.mkdirSync(scopedPkg, { recursive: true });
      writeManifest(scopedPkg, makeManifest({
        name: '@myorg/architect-rule',
        version: '0.5.0',
      }));

      const registry = new PluginRegistry(tmpDir);
      const discovered = registry.discover();

      expect(discovered).toHaveLength(1);
      expect(discovered[0]!.name).toBe('@myorg/architect-rule');
    });

    it('should return empty array when no plugins directory', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      expect(registry.discover()).toEqual([]);
    });

    it('should skip packages without manifest', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const noManifest = path.join(tmpDir, '.architect', 'plugins', 'node_modules', 'random-pkg');
      fs.mkdirSync(noManifest, { recursive: true });
      // No architect-plugin.json

      const registry = new PluginRegistry(tmpDir);
      expect(registry.discover()).toEqual([]);
    });
  });

  describe('loadAll', () => {
    it('should skip disabled plugins', async () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).entries.set('disabled-one', makePluginEntry({
        name: 'disabled-one',
        enabled: false,
      }));

      const plugins = await registry.loadAll({});
      expect(plugins).toHaveLength(0);
    });

    it('should handle plugin load errors gracefully', async () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).entries.set('broken-plugin', makePluginEntry({
        name: 'broken-plugin',
        resolvedPath: '/nonexistent/path/to/plugin',
        enabled: true,
      }));

      // Should not throw
      const plugins = await registry.loadAll({});
      expect(plugins).toHaveLength(0);
    });

    it('should only attempt to load enabled entries', async () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).entries.set('enabled', makePluginEntry({
        name: 'enabled',
        resolvedPath: '/nonexistent',
        enabled: true,
      }));
      (registry as any).entries.set('disabled', makePluginEntry({
        name: 'disabled',
        resolvedPath: '/also-nonexistent',
        enabled: false,
      }));

      // Both will fail to load, but disabled won't even be attempted
      const plugins = await registry.loadAll({});
      expect(plugins).toHaveLength(0);
    });
  });

  describe('getRefactorRules', () => {
    it('should collect refactor rules from manually loaded plugins', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);

      // Simulate a loaded plugin by directly inserting into loadedPlugins
      const fakePlugin = {
        name: 'rule-plugin',
        version: '1.0.0',
        refactorRules: [
          { name: 'custom-rule-1', tier: 2 as const, analyze: () => [] },
          { name: 'custom-rule-2', tier: 2 as const, analyze: () => [] },
        ],
      };
      (registry as any).loadedPlugins.set('rule-plugin', fakePlugin);

      const rules = registry.getRefactorRules();
      expect(rules).toHaveLength(2);
      expect(rules[0]!.name).toBe('custom-rule-1');
      expect(rules[1]!.name).toBe('custom-rule-2');
    });

    it('should return empty array when no plugins have rules', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      expect(registry.getRefactorRules()).toEqual([]);
    });

    it('should aggregate rules from multiple plugins', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).loadedPlugins.set('plugin-a', {
        name: 'plugin-a',
        version: '1.0.0',
        refactorRules: [{ name: 'rule-a', tier: 1 as const, analyze: () => [] }],
      });
      (registry as any).loadedPlugins.set('plugin-b', {
        name: 'plugin-b',
        version: '1.0.0',
        refactorRules: [{ name: 'rule-b', tier: 2 as const, analyze: () => [] }],
      });

      const rules = registry.getRefactorRules();
      expect(rules).toHaveLength(2);
      expect(rules.map(r => r.name)).toEqual(['rule-a', 'rule-b']);
    });
  });

  describe('getAntiPatternDetectors', () => {
    it('should wrap anti-pattern detectors from loaded plugins', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).loadedPlugins.set('ap-plugin', {
        name: 'ap-plugin',
        version: '1.0.0',
        detectAntiPatterns: () => [],
      });

      const detectors = registry.getAntiPatternDetectors();
      expect(detectors).toHaveLength(1);
      expect(typeof detectors[0]).toBe('function');
    });
  });

  describe('getLoadedPlugins', () => {
    it('should return all loaded plugin instances', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      (registry as any).loadedPlugins.set('p1', { name: 'p1', version: '1.0.0' });
      (registry as any).loadedPlugins.set('p2', { name: 'p2', version: '2.0.0' });

      const loaded = registry.getLoadedPlugins();
      expect(loaded).toHaveLength(2);
    });

    it('should return empty array when nothing loaded', () => {
      const tmpDir = createTempDir();
      tempDirs.push(tmpDir);

      const registry = new PluginRegistry(tmpDir);
      expect(registry.getLoadedPlugins()).toEqual([]);
    });
  });
});
