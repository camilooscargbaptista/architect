/**
 * Plugin Registry — Discovery, Installation & Management
 *
 * Handles plugin discovery from multiple sources (local, npm),
 * installation, activation, and lifecycle management.
 *
 * @since v9.0 — Fase 3.4
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import {
  ArchitectPlugin,
  PluginContext,
  PluginEntry,
  PluginManifest,
  PluginSearchResult,
  CustomAntiPatternDetector,
} from './types/plugin.js';
import { RefactorRule } from './types/rules.js';
import { ArchitectConfig } from './types/core.js';
import { logger } from '../infrastructure/logger.js';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const MANIFEST_FILENAME = 'architect-plugin.json';
const PLUGINS_DIR = '.architect/plugins';
const REGISTRY_FILE = '.architect/plugin-registry.json';

// ═══════════════════════════════════════════════════════════════
// REGISTRY PERSISTENCE
// ═══════════════════════════════════════════════════════════════

interface RegistryData {
  version: 1;
  plugins: PluginEntry[];
}

// ═══════════════════════════════════════════════════════════════
// PLUGIN REGISTRY
// ═══════════════════════════════════════════════════════════════

export class PluginRegistry {
  private entries: Map<string, PluginEntry> = new Map();
  private loadedPlugins: Map<string, ArchitectPlugin> = new Map();
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  // ── Persistence ──────────────────────────────────────────────

  /**
   * Load the plugin registry from disk (.architect/plugin-registry.json).
   */
  load(): void {
    const registryPath = path.join(this.projectPath, REGISTRY_FILE);
    try {
      if (fs.existsSync(registryPath)) {
        const raw = fs.readFileSync(registryPath, 'utf-8');
        const data = JSON.parse(raw) as RegistryData;
        if (data.version === 1 && Array.isArray(data.plugins)) {
          for (const entry of data.plugins) {
            this.entries.set(entry.name, entry);
          }
        }
      }
    } catch (err) {
      logger.warn(`[PluginRegistry] Failed to load registry: ${(err as Error).message}`);
    }
  }

  /**
   * Persist the registry to disk.
   */
  save(): void {
    const registryPath = path.join(this.projectPath, REGISTRY_FILE);
    const dir = path.dirname(registryPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: RegistryData = {
      version: 1,
      plugins: [...this.entries.values()],
    };

    fs.writeFileSync(registryPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  // ── Query ────────────────────────────────────────────────────

  /**
   * List all registered plugins.
   */
  list(): PluginEntry[] {
    return [...this.entries.values()];
  }

  /**
   * Get a specific plugin entry by name.
   */
  get(name: string): PluginEntry | undefined {
    return this.entries.get(name);
  }

  /**
   * Check if a plugin is registered.
   */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  // ── Install ──────────────────────────────────────────────────

  /**
   * Install a plugin from a local path.
   *
   * Expects the path to contain either:
   * - An architect-plugin.json manifest
   * - A valid ESM module exporting ArchitectPlugin
   */
  installLocal(localPath: string): PluginEntry {
    const resolvedPath = path.resolve(this.projectPath, localPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Plugin path not found: ${resolvedPath}`);
    }

    // Try to read manifest
    const manifest = this.readManifest(resolvedPath);
    const name = manifest?.name ?? path.basename(resolvedPath);
    const version = manifest?.version ?? '0.0.0';

    const entry: PluginEntry = {
      name,
      version,
      source: 'local',
      resolvedPath,
      enabled: true,
      ...(manifest ? { manifest } : {}),
    };

    this.entries.set(name, entry);
    this.save();
    logger.info(`[PluginRegistry] Installed local plugin: ${name}@${version}`);
    return entry;
  }

  /**
   * Install a plugin from npm.
   *
   * Runs `npm install` in the project's .architect/plugins directory,
   * then registers the plugin.
   */
  installNpm(packageName: string, versionSpec?: string): PluginEntry {
    const pluginsDir = path.join(this.projectPath, PLUGINS_DIR);

    // Ensure plugins directory exists with a package.json
    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    const pkgJsonPath = path.join(pluginsDir, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      fs.writeFileSync(pkgJsonPath, JSON.stringify({
        name: 'architect-plugins',
        version: '1.0.0',
        private: true,
        type: 'module',
      }, null, 2), 'utf-8');
    }

    // Install via npm
    const spec = versionSpec ? `${packageName}@${versionSpec}` : packageName;
    try {
      execSync(`npm install ${spec}`, {
        cwd: pluginsDir,
        stdio: 'pipe',
        timeout: 60000,
      });
    } catch (err) {
      throw new Error(`npm install failed for '${spec}': ${(err as Error).message}`);
    }

    // Resolve installed path
    const resolvedPath = path.join(pluginsDir, 'node_modules', packageName);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Package installed but not found at ${resolvedPath}`);
    }

    const manifest = this.readManifest(resolvedPath);

    // Read version from installed package.json
    let installedVersion = '0.0.0';
    const installedPkgJson = path.join(resolvedPath, 'package.json');
    if (fs.existsSync(installedPkgJson)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(installedPkgJson, 'utf-8'));
        installedVersion = pkg.version ?? '0.0.0';
      } catch {
        // ignore parse errors
      }
    }

    const entry: PluginEntry = {
      name: packageName,
      version: manifest?.version ?? installedVersion,
      source: 'npm',
      resolvedPath,
      enabled: true,
      ...(manifest ? { manifest } : {}),
    };

    this.entries.set(packageName, entry);
    this.save();
    logger.info(`[PluginRegistry] Installed npm plugin: ${packageName}@${entry.version}`);
    return entry;
  }

  // ── Uninstall ────────────────────────────────────────────────

  /**
   * Remove a plugin from the registry.
   */
  uninstall(name: string): boolean {
    const entry = this.entries.get(name);
    if (!entry) return false;

    // Deactivate if loaded
    const loaded = this.loadedPlugins.get(name);
    if (loaded?.deactivate) {
      try {
        loaded.deactivate();
      } catch {
        // ignore deactivation errors during uninstall
      }
    }
    this.loadedPlugins.delete(name);

    // If npm-installed, try to uninstall
    if (entry.source === 'npm') {
      const pluginsDir = path.join(this.projectPath, PLUGINS_DIR);
      try {
        execSync(`npm uninstall ${name}`, {
          cwd: pluginsDir,
          stdio: 'pipe',
          timeout: 30000,
        });
      } catch {
        logger.warn(`[PluginRegistry] npm uninstall failed for '${name}', removing from registry anyway`);
      }
    }

    this.entries.delete(name);
    this.save();
    logger.info(`[PluginRegistry] Uninstalled plugin: ${name}`);
    return true;
  }

  // ── Enable / Disable ─────────────────────────────────────────

  /**
   * Enable or disable a plugin.
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const entry = this.entries.get(name);
    if (!entry) return false;

    entry.enabled = enabled;
    this.entries.set(name, entry);
    this.save();
    return true;
  }

  // ── Loading & Activation ─────────────────────────────────────

  /**
   * Load and activate all enabled plugins.
   * Returns the loaded ArchitectPlugin instances.
   */
  async loadAll(config: ArchitectConfig): Promise<ArchitectPlugin[]> {
    const context: PluginContext = {
      projectPath: this.projectPath,
      config,
    };

    const plugins: ArchitectPlugin[] = [];

    for (const entry of this.entries.values()) {
      if (!entry.enabled) continue;

      try {
        const plugin = await this.loadPlugin(entry);
        if (plugin.activate) {
          await plugin.activate(context);
        }
        this.loadedPlugins.set(entry.name, plugin);
        plugins.push(plugin);
        logger.info(`[PluginRegistry] Activated plugin: ${entry.name}@${entry.version}`);
      } catch (err) {
        logger.warn(`[PluginRegistry] Failed to load plugin '${entry.name}': ${(err as Error).message}`);
      }
    }

    return plugins;
  }

  /**
   * Get all refactor rules from loaded plugins.
   */
  getRefactorRules(): RefactorRule[] {
    const rules: RefactorRule[] = [];
    for (const plugin of this.loadedPlugins.values()) {
      if (plugin.refactorRules) {
        rules.push(...plugin.refactorRules);
      }
    }
    return rules;
  }

  /**
   * Get all custom anti-pattern detectors from loaded plugins.
   */
  getAntiPatternDetectors(): CustomAntiPatternDetector[] {
    const detectors: CustomAntiPatternDetector[] = [];
    for (const [_name, plugin] of this.loadedPlugins) {
      if (plugin.detectAntiPatterns) {
        const context: PluginContext = {
          projectPath: this.projectPath,
          config: {} as ArchitectConfig,
        };
        // Wrap to auto-inject context
        const wrapped: CustomAntiPatternDetector = async (fileTree, deps) => {
          return plugin.detectAntiPatterns!(fileTree, deps, context);
        };
        detectors.push(wrapped);
      }
    }
    return detectors;
  }

  /**
   * Get all loaded plugin instances.
   */
  getLoadedPlugins(): ArchitectPlugin[] {
    return [...this.loadedPlugins.values()];
  }

  // ── Search (npm registry) ────────────────────────────────────

  /**
   * Search npm for architect plugins.
   * Uses `npm search` with the architect-plugin keyword.
   */
  searchNpm(query: string): PluginSearchResult[] {
    try {
      const searchQuery = `architect-plugin ${query}`;
      const output = execSync(
        `npm search "${searchQuery}" --json 2>/dev/null || echo "[]"`,
        { timeout: 15000, encoding: 'utf-8' },
      );

      const results = JSON.parse(output) as Array<{
        name: string;
        version: string;
        description: string;
        keywords: string[];
        author?: { name: string };
      }>;

      return results
        .filter(r => r.name && r.version)
        .map(r => ({
          name: r.name,
          version: r.version,
          description: r.description ?? '',
          keywords: r.keywords ?? [],
          ...(r.author?.name ? { author: r.author.name } : {}),
        }));
    } catch {
      logger.warn('[PluginRegistry] npm search failed');
      return [];
    }
  }

  // ── Discovery (auto-detect) ──────────────────────────────────

  /**
   * Auto-discover plugins from:
   * 1. .architect/plugins/node_modules/
   * 2. Config plugins[] array
   * 3. Local directories with architect-plugin.json
   */
  discover(): PluginEntry[] {
    const discovered: PluginEntry[] = [];

    // 1. Scan .architect/plugins/node_modules for packages with architect-plugin.json
    const npmPluginsDir = path.join(this.projectPath, PLUGINS_DIR, 'node_modules');
    if (fs.existsSync(npmPluginsDir)) {
      const entries = fs.readdirSync(npmPluginsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

        // Handle scoped packages (@scope/name)
        if (entry.name.startsWith('@')) {
          const scopeDir = path.join(npmPluginsDir, entry.name);
          const scopedEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
          for (const scoped of scopedEntries) {
            if (!scoped.isDirectory()) continue;
            const pkgPath = path.join(scopeDir, scoped.name);
            const manifest = this.readManifest(pkgPath);
            if (manifest) {
              discovered.push({
                name: `${entry.name}/${scoped.name}`,
                version: manifest.version,
                source: 'npm',
                resolvedPath: pkgPath,
                enabled: false,
                manifest,
              });
            }
          }
        } else {
          const pkgPath = path.join(npmPluginsDir, entry.name);
          const manifest = this.readManifest(pkgPath);
          if (manifest) {
            discovered.push({
              name: entry.name,
              version: manifest.version,
              source: 'npm',
              resolvedPath: pkgPath,
              enabled: false,
              manifest,
            });
          }
        }
      }
    }

    return discovered;
  }

  // ── Internal ─────────────────────────────────────────────────

  /**
   * Read an architect-plugin.json manifest from a directory.
   */
  private readManifest(dir: string): PluginManifest | undefined {
    const manifestPath = path.join(dir, MANIFEST_FILENAME);
    try {
      if (fs.existsSync(manifestPath)) {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw) as PluginManifest;
        if (manifest.name && manifest.version && manifest.hooks) {
          return manifest;
        }
      }
    } catch {
      // Invalid manifest, skip
    }
    return undefined;
  }

  /**
   * Dynamically import and instantiate a plugin.
   */
  private async loadPlugin(entry: PluginEntry): Promise<ArchitectPlugin> {
    let entryPoint = entry.resolvedPath;

    // Determine entry point
    if (entry.manifest?.main) {
      entryPoint = path.join(entry.resolvedPath, entry.manifest.main);
    } else {
      // Try common entry points
      const candidates = ['index.js', 'index.mjs', 'dist/index.js'];
      for (const candidate of candidates) {
        const fullPath = path.join(entry.resolvedPath, candidate);
        if (fs.existsSync(fullPath)) {
          entryPoint = fullPath;
          break;
        }
      }
    }

    // Handle Windows file:// URIs
    if (process.platform === 'win32') {
      entryPoint = `file://${entryPoint.replace(/\\/g, '/')}`;
    }

    const pluginModule = await import(entryPoint);
    const plugin: ArchitectPlugin = pluginModule.default ?? pluginModule;

    if (!plugin || typeof plugin !== 'object') {
      throw new Error(`Plugin '${entry.name}' does not export a valid ArchitectPlugin object`);
    }

    if (!plugin.name) {
      plugin.name = entry.name;
    }
    if (!plugin.version) {
      plugin.version = entry.version;
    }

    return plugin;
  }
}
