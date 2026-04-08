import { readFileSync } from 'fs';
import { join } from 'path';
import { ArchitectConfig } from './types/core.js';

const DEFAULT_CONFIG: ArchitectConfig = {
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.git/**',
    '**/.next/**',
    '**/venv/**',
    '**/__pycache__/**',
    '**/target/**',
    '**/out/**',
    '**/.cache/**',
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
  scoringProfile: 'auto',
  monorepo: {
    enabled: true,
    treatPackagesAsModules: true,
  },
  plugins: [],
};

/**
 * Normalize ignore patterns to use proper glob syntax.
 * Simple names like "node_modules" are expanded to cover nested directories:
 * "node_modules" → ["node_modules", "node_modules/**", "** /node_modules", "** /node_modules/**"]
 */
export function normalizeIgnorePatterns(patterns: string[]): string[] {
  const normalized = new Set<string>();

  for (const p of patterns) {
    if (p.includes('*') || p.includes('/')) {
      // Already a glob pattern — keep as-is
      normalized.add(p);
    } else {
      // Simple directory name — expand to cover all nesting levels
      normalized.add(p);
      normalized.add(`${p}/**`);
      normalized.add(`**/${p}`);
      normalized.add(`**/${p}/**`);
    }
  }

  return [...normalized];
}

export class ConfigLoader {
  static loadConfig(projectPath: string): ArchitectConfig {
    const configPath = join(projectPath, '.architect.json');

    try {
      const content = readFileSync(configPath, 'utf-8');
      const userConfig = JSON.parse(content) as ArchitectConfig;
      return this.mergeConfigs(DEFAULT_CONFIG, userConfig);
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  private static mergeConfigs(
    defaults: ArchitectConfig,
    user: ArchitectConfig
  ): ArchitectConfig {
    // If user provides ignore patterns, normalize them to proper glob format
    const userIgnore = user.ignore
      ? normalizeIgnorePatterns(user.ignore)
      : defaults.ignore;

    const detect = user.frameworks?.detect ?? defaults.frameworks?.detect;
    const linesThreshold = user.antiPatterns?.godClass?.linesThreshold ?? defaults.antiPatterns?.godClass?.linesThreshold;
    const methodsThreshold = user.antiPatterns?.godClass?.methodsThreshold ?? defaults.antiPatterns?.godClass?.methodsThreshold;
    const changePropagationThreshold = user.antiPatterns?.shotgunSurgery?.changePropagationThreshold ?? defaults.antiPatterns?.shotgunSurgery?.changePropagationThreshold;
    const modularity = user.score?.modularity ?? defaults.score?.modularity;
    const coupling = user.score?.coupling ?? defaults.score?.coupling;
    const cohesion = user.score?.cohesion ?? defaults.score?.cohesion;
    const layering = user.score?.layering ?? defaults.score?.layering;
    const enabled = user.monorepo?.enabled ?? defaults.monorepo?.enabled;
    const treatPackagesAsModules = user.monorepo?.treatPackagesAsModules ?? defaults.monorepo?.treatPackagesAsModules;
    const plugins = user.plugins ?? defaults.plugins;
    const scoringProfile = user.scoringProfile ?? defaults.scoringProfile;

    const config: ArchitectConfig = {
      ...(userIgnore !== undefined && { ignore: userIgnore }),
      ...(plugins !== undefined && { plugins }),
      frameworks: {
        ...(detect !== undefined && { detect }),
      },
      antiPatterns: {
        godClass: {
          ...(linesThreshold !== undefined && { linesThreshold }),
          ...(methodsThreshold !== undefined && { methodsThreshold }),
        },
        shotgunSurgery: {
          ...(changePropagationThreshold !== undefined && { changePropagationThreshold }),
        },
      },
      score: {
        ...(modularity !== undefined && { modularity }),
        ...(coupling !== undefined && { coupling }),
        ...(cohesion !== undefined && { cohesion }),
        ...(layering !== undefined && { layering }),
      },
      ...(scoringProfile !== undefined && { scoringProfile }),
      monorepo: {
        ...(enabled !== undefined && { enabled }),
        ...(treatPackagesAsModules !== undefined && { treatPackagesAsModules }),
      },
    };

    return config;
  }
}
