import { readFileSync } from 'fs';
import { join } from 'path';
import { ArchitectConfig } from './types.js';

const DEFAULT_CONFIG: ArchitectConfig = {
  ignore: [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.git',
    '.next',
    'venv',
    '__pycache__',
    'target',
  ],
  frameworks: {
    detect: true,
  },
  antiPatterns: {
    godClass: {
      linesThreshold: 500,
      methodsThreshold: 10,
    },
    shotgunSurgery: {
      changePropagationThreshold: 5,
    },
  },
  score: {
    modularity: 0.4,
    coupling: 0.25,
    cohesion: 0.2,
    layering: 0.15,
  },
};

export class ConfigLoader {
  static loadConfig(projectPath: string): ArchitectConfig {
    const configPath = join(projectPath, '.architect.json');

    try {
      const content = readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(content) as ArchitectConfig;
      return this.mergeConfigs(DEFAULT_CONFIG, userConfig);
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  private static mergeConfigs(
    defaults: ArchitectConfig,
    user: ArchitectConfig
  ): ArchitectConfig {
    return {
      ignore: user.ignore ?? defaults.ignore,
      frameworks: {
        detect: user.frameworks?.detect ?? defaults.frameworks?.detect,
      },
      antiPatterns: {
        godClass: {
          linesThreshold:
            user.antiPatterns?.godClass?.linesThreshold ??
            defaults.antiPatterns?.godClass?.linesThreshold,
          methodsThreshold:
            user.antiPatterns?.godClass?.methodsThreshold ??
            defaults.antiPatterns?.godClass?.methodsThreshold,
        },
        shotgunSurgery: {
          changePropagationThreshold:
            user.antiPatterns?.shotgunSurgery?.changePropagationThreshold ??
            defaults.antiPatterns?.shotgunSurgery?.changePropagationThreshold,
        },
      },
      score: {
        modularity: user.score?.modularity ?? defaults.score?.modularity,
        coupling: user.score?.coupling ?? defaults.score?.coupling,
        cohesion: user.score?.cohesion ?? defaults.score?.cohesion,
        layering: user.score?.layering ?? defaults.score?.layering,
      },
    };
  }
}
