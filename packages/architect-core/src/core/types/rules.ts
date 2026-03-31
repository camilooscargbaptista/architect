import { ArchitectureScore, AnalysisReport } from './core.js';

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
  aiPrompt?: string;
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
