export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  extension?: string;
  lines?: number;
  language?: string;
  children?: FileNode[];
  imports?: string[];
  exports?: string[];
}

export interface WorkspaceInfo {
  name: string;
  path: string;
  relativePath: string;
  description: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  bin?: Record<string, string>;
  main?: string;
}

export interface ProjectInfo {
  path: string;
  name: string;
  frameworks: string[];
  totalFiles: number;
  totalLines: number;
  primaryLanguages: string[];
  fileTree?: FileNode;
  workspaces?: WorkspaceInfo[];
}

export interface ParsedImport {
  source: string;
  names: string[];
  isDefault: boolean;
  isNamespace: boolean;
}
