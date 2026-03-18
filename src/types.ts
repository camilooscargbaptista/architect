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

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'export' | 'inheritance' | 'composition';
  weight: number;
}

export interface Layer {
  name: 'API' | 'Service' | 'Data' | 'UI' | 'Infrastructure';
  files: string[];
  description: string;
}

export interface AntiPattern {
  name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  location: string;
  description: string;
  suggestion: string;
  affectedFiles?: string[];
  metrics?: Record<string, number | string>;
}

export interface ScoreComponent {
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  explanation: string;
}

export interface ArchitectureScore {
  overall: number;
  components: ScoreComponent[];
  breakdown: {
    modularity: number;
    coupling: number;
    cohesion: number;
    layering: number;
  };
}

export interface ProjectInfo {
  path: string;
  name: string;
  frameworks: string[];
  totalFiles: number;
  totalLines: number;
  primaryLanguages: string[];
  fileTree?: FileNode;
}

export interface AnalysisReport {
  timestamp: string;
  projectInfo: ProjectInfo;
  score: ArchitectureScore;
  antiPatterns: AntiPattern[];
  layers: Layer[];
  dependencyGraph: {
    nodes: string[];
    edges: DependencyEdge[];
  };
  suggestions: {
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    impact: string;
  }[];
  diagram: {
    mermaid: string;
    type: 'component' | 'layer' | 'dependency';
  };
}

export interface ArchitectConfig {
  ignore?: string[];
  frameworks?: {
    detect?: boolean;
  };
  antiPatterns?: {
    godClass?: {
      linesThreshold?: number;
      methodsThreshold?: number;
    };
    shotgunSurgery?: {
      changePropagationThreshold?: number;
    };
  };
  score?: {
    modularity?: number;
    coupling?: number;
    cohesion?: number;
    layering?: number;
  };
}

export interface ParsedImport {
  source: string;
  names: string[];
  isDefault: boolean;
  isNamespace: boolean;
}
