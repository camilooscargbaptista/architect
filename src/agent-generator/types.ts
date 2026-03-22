import { AnalysisReport, RefactoringPlan } from '../types.js';

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
 * Audit finding for existing agent directories.
 */
export interface AgentAuditFinding {
  type: 'MISSING' | 'OUTDATED' | 'IMPROVEMENT' | 'OK';
  category: string;
  file: string;
  description: string;
  suggestion?: string;
}

/**
 * Status of each agent system item relative to existing .agent/ directory.
 */
export type AgentItemStatus = 'KEEP' | 'MODIFY' | 'CREATE' | 'DELETE';

export interface AgentItem {
  name: string;
  status: AgentItemStatus;
  reason?: string;
  description?: string;
}

/**
 * Result from suggest() — no files written, just recommendations.
 */
export interface AgentSuggestion {
  stack: StackInfo;
  hasExistingAgents: boolean;
  suggestedAgents: AgentItem[];
  suggestedRules: AgentItem[];
  suggestedGuards: AgentItem[];
  suggestedWorkflows: AgentItem[];
  suggestedSkills: { name: string; source: string; description: string; status: AgentItemStatus }[];
  audit: AgentAuditFinding[];
  command: string;
}

/**
 * Context passed to all template generators.
 */
export interface TemplateContext {
  report: AnalysisReport;
  plan: RefactoringPlan;
  stack: StackInfo;
  projectName: string;
  stackLabel: string;
  config: AgentGeneratorConfig;
}

/**
 * Configuration for agent generation — customizable per project.
 */
export interface AgentGeneratorConfig {
  coverageMinimum: number;
  scoreThreshold: number;
  language: 'pt-BR' | 'en';
  goldenRules: string[];
  blockers: string[];
}

export const DEFAULT_AGENT_CONFIG: AgentGeneratorConfig = {
  coverageMinimum: 80,
  scoreThreshold: 70,
  language: 'pt-BR',
  goldenRules: [
    'Git Flow completo (branch → PR → review → merge)',
    'Arquitetura C4 (4 níveis de documentação)',
    'BDD antes de código',
    'TDD — Red → Green → Refactor',
    'Diagnóstico obrigatório antes de codar',
    'Mockup antes de qualquer UI',
    'Nunca decidir sozinho — perguntar ao humano',
    'Qualidade > Velocidade',
    'Não abrir browser, não tirar screenshot — apenas código',
  ],
  blockers: [
    'console.log / print() em código de produção',
    'TODO / FIXME / HACK sem issue vinculada',
    'any (TypeScript) / type: ignore (Python) sem justificativa',
    'Testes com .skip() ou @pytest.mark.skip sem motivo',
    'Secrets, tokens ou senhas hardcoded',
    'Push direto em main/develop',
    'Arquivos > 500 linhas sem justificativa',
    'Imports circulares',
  ],
};
