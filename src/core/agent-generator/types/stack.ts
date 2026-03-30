/**
 * Stack detection result from project analysis.
 */
export interface StackInfo {
  primary: string;
  languages: string[];
  frameworks: string[];
  hasBackend: boolean;
  hasFrontend: boolean;
  hasMobile: boolean;
  hasDatabase: boolean;
  testFramework: string;
  packageManager: string;
}

/**
 * Detected framework with version, detected from dependency files.
 */
export interface FrameworkInfo {
  name: string;
  version: string | null;
  category: 'web' | 'orm' | 'test' | 'lint' | 'build' | 'other';
  confidence: number;
}

/**
 * Detected toolchain — build, test, lint, run commands.
 */
export interface DetectedToolchain {
  buildCmd: string;
  testCmd: string;
  lintCmd: string;
  runCmd: string;
  coverageCmd: string;
  installCmd: string;
  migrateCmd: string | null;
  depsFile: string;
}
