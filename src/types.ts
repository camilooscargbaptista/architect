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
  projectSummary?: ProjectSummary;
}

export interface ProjectSummary {
  description: string;
  purpose: string;
  modules: { name: string; files: number; description: string }[];
  techStack: string[];
  entryPoints: string[];
  keywords: string[];
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

// ── v2.0 Refactoring Types ──

export interface RefactoringPlan {
  timestamp: string;
  projectPath: string;
  currentScore: ArchitectureScore;
  estimatedScoreAfter: { overall: number; breakdown: Record<string, number> };
  steps: RefactorStep[];
  totalOperations: number;
  tier1Steps: number;
  tier2Steps: number;
}

export interface RefactorStep {
  id: number;
  tier: 1 | 2;
  rule: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  rationale: string;
  operations: FileOperation[];
  scoreImpact: { metric: string; before: number; after: number }[];
  codePreview?: string;
}

export interface FileOperation {
  type: 'CREATE' | 'MOVE' | 'MODIFY' | 'DELETE';
  path: string;
  newPath?: string;
  content?: string;
  diff?: string;
  description: string;
}

export interface CodeSymbol {
  name: string;
  type: 'function' | 'class' | 'variable' | 'import' | 'export';
  startLine: number;
  endLine: number;
  lines: number;
  dependencies: string[];
  usedBy: string[];
}

export interface RefactorRule {
  name: string;
  tier: 1 | 2;
  analyze(report: AnalysisReport, projectPath: string): RefactorStep[];
}

