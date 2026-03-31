import { AntiPattern, ArchitectConfig } from './core.js';
import { FileNode } from './infrastructure.js';

export interface PluginContext {
  projectPath: string;
  config: ArchitectConfig;
}

export type CustomAntiPatternDetector = (
  fileTree: FileNode,
  dependencies: Map<string, Set<string>>,
  context: PluginContext
) => AntiPattern[] | Promise<AntiPattern[]>;

export interface ArchitectPlugin {
  name: string;
  version: string;
  detectAntiPatterns?: CustomAntiPatternDetector;
}
