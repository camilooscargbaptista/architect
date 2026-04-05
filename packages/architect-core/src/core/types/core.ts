import {  ProjectInfo } from './infrastructure.js';
import { ProjectSummary } from './summarizer.js';

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'export' | 'inheritance' | 'composition';
  weight: number;
}

/**
 * Pre-computed dependency index for O(1) per-file edge lookups.
 *
 * Built once in RefactorEngine.analyze() and passed to all rules,
 * eliminating redundant O(E) scans per rule. For projects with 10K+ files
 * and 5 rules, this reduces total edge iterations from O(5E) to O(E).
 *
 * @since v8.2.0 — Fase 2.6
 */
export interface DependencyIndex {
  /** Edges grouped by target file (who imports this file?) */
  incomingByFile: Map<string, DependencyEdge[]>;
  /** Edges grouped by source file (what does this file import?) */
  outgoingByFile: Map<string, DependencyEdge[]>;
  /** Fan-in count per file (number of incoming edges) */
  fanIn: Map<string, number>;
  /** Fan-out count per file (number of outgoing edges) */
  fanOut: Map<string, number>;
}

/**
 * Builds a DependencyIndex from a flat edge list in a single O(E) pass.
 */
export function buildDependencyIndex(edges: DependencyEdge[]): DependencyIndex {
  const incomingByFile = new Map<string, DependencyEdge[]>();
  const outgoingByFile = new Map<string, DependencyEdge[]>();

  for (const edge of edges) {
    let incoming = incomingByFile.get(edge.to);
    if (!incoming) {
      incoming = [];
      incomingByFile.set(edge.to, incoming);
    }
    incoming.push(edge);

    let outgoing = outgoingByFile.get(edge.from);
    if (!outgoing) {
      outgoing = [];
      outgoingByFile.set(edge.from, outgoing);
    }
    outgoing.push(edge);
  }

  const fanIn = new Map<string, number>();
  const fanOut = new Map<string, number>();
  for (const [file, edges] of incomingByFile) fanIn.set(file, edges.length);
  for (const [file, edges] of outgoingByFile) fanOut.set(file, edges.length);

  return { incomingByFile, outgoingByFile, fanIn, fanOut };
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

/** Target LLM model for Genesis prompt generation. Affects token budget. */
export type GenesisTargetModel = 'gpt-4o' | 'claude-3' | 'gemini-pro' | 'qwen-32b' | 'custom';

export interface GenesisConfig {
  /** Max estimated tokens per generated prompt. Default: 30000 */
  maxTokensPerPrompt?: number;
  /** Max number of full file inlines per step. Default: 5 */
  maxFullFileInlines?: number;
  /** Max lines per individual file inline. Default: 300 */
  maxLinesPerFile?: number;
  /** Include abbreviated context for overflow files. Default: true */
  includeAbbreviatedContext?: boolean;
  /** Target model — selects a preset budget. Default: 'claude-3' */
  targetModel?: GenesisTargetModel;
  /** Custom token limit when targetModel is 'custom'. */
  customTokenLimit?: number;
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
  monorepo?: {
    enabled?: boolean;
    treatPackagesAsModules?: boolean;
  };
  plugins?: string[];
  /** Genesis Engine configuration — prompt budget and target model. */
  genesis?: GenesisConfig;
}
