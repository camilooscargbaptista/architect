import { jest } from '@jest/globals';
import { PluginLoader } from '../src/core/plugin-loader.js';
import { ArchitectConfig } from '../src/core/types/core.js';
import { PluginContext, ArchitectPlugin, CustomAntiPatternDetector } from '../src/core/types/plugin.js';

describe('PluginLoader', () => {
  const mockConfig: ArchitectConfig = {
    plugins: ['fake-plugin'],
  };

  it('should instantiate empty custom detectors if no plugins config', async () => {
    const loader = new PluginLoader('/fake/path', {});
    await loader.loadPlugins();
    
    expect(loader.customAntiPatternDetectors.length).toBe(0);
  });

  it('should ignore plugins if empty array provided', async () => {
    const loader = new PluginLoader('/fake/path', { plugins: [] });
    await loader.loadPlugins();
    
    expect(loader.customAntiPatternDetectors.length).toBe(0);
  });

  // Cannot easily mock native ESM dynamic import() within Jest cleanly without 
  // complex module mocks since Jest execution in this repo runs --experimental-vm-modules.
  // We mock a failing dynamic load instead, which should be safely caught.
  it('should gracefully handle missing plugins via dynamic load catch', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = new PluginLoader('/fake/path', mockConfig);
    
    await loader.loadPlugins();
    
    // It should log a warning but NOT throw an unhandled promise rejection
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[Architect Plugin] Failed to load plugin \'fake-plugin\''));
    expect(loader.customAntiPatternDetectors.length).toBe(0);
    
    consoleSpy.mockRestore();
  });
});
