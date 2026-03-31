import path from 'path';
import fs from 'fs';
import { ArchitectPlugin, CustomAntiPatternDetector, PluginContext } from './types/plugin.js';
import { ArchitectConfig } from './types/core.js';

export class PluginLoader {
  private customDetectors: CustomAntiPatternDetector[] = [];
  
  constructor(
    private projectPath: string,
    private config: ArchitectConfig
  ) {}

  public get customAntiPatternDetectors(): CustomAntiPatternDetector[] {
    return this.customDetectors;
  }

  public async loadPlugins(): Promise<void> {
    if (!this.config.plugins || this.config.plugins.length === 0) {
      return;
    }

    const context: PluginContext = {
      projectPath: this.projectPath,
      config: this.config
    };

    for (const pluginSpec of this.config.plugins) {
      try {
        await this.loadSinglePlugin(pluginSpec, context);
      } catch (err) {
        console.warn(`[Architect Plugin] Failed to load plugin '${pluginSpec}': ${(err as Error).message}`);
      }
    }
  }

  private async loadSinglePlugin(pluginSpec: string, context: PluginContext): Promise<void> {
    // 1. Resolve path (could be relative to project or node_modules)
    let pluginPath = pluginSpec;
    
    // If it starts with ./ or ../ we assume it's relative to the target project
    if (pluginSpec.startsWith('./') || pluginSpec.startsWith('../')) {
      pluginPath = path.resolve(this.projectPath, pluginSpec);
    }

    // Verify file exists if we are resolving a local JS file to avoid unhelpful stack traces
    if (!pluginSpec.startsWith('@') && !pluginSpec.match(/^[a-z0-9_-]+$/i)) {
      if (!fs.existsSync(pluginPath)) {
        throw new Error(`File not found at ${pluginPath}`);
      }
      
      // Node 20+ ESM dynamic imports need absolute file:// URIs on Windows
      if (process.platform === 'win32') {
        pluginPath = `file://${pluginPath.replace(/\\/g, '/')}`;
      }
    }

    // 2. Load the module using dynamic import
    const pluginModule = await import(pluginPath);
    
    // 3. Extract default export mapping
    const plugin: ArchitectPlugin = pluginModule.default || pluginModule;
    
    if (!plugin || typeof plugin !== 'object') {
      throw new Error(`Plugin must export an 'ArchitectPlugin' object as default.`);
    }

    // 4. Register hooks
    if (typeof plugin.detectAntiPatterns === 'function') {
      // Wrap the detector so it automatically receives the PluginContext
      const wrappedDetector: CustomAntiPatternDetector = async (fileTree, deps) => {
        return plugin.detectAntiPatterns!(fileTree, deps, context);
      };
      
      this.customDetectors.push(wrappedDetector);
      console.log(`[Architect Plugin] Registered Custom Rules from: ${plugin.name || pluginSpec}`);
    }
  }
}
