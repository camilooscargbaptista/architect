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

/**
 * Domain classification inferred from project analysis.
 */
export interface DomainInsights {
  /** Primary domain category (e.g., 'fintech', 'healthtech', 'e-commerce') */
  domain: string;
  /** Specific sub-domain (e.g., 'tax-processing', 'payment-gateway') */
  subDomain: string;
  /** Human-readable description of what the project does */
  description: string;
  /** Business entities detected from models/entities/schemas */
  businessEntities: BusinessEntity[];
  /** Regulatory/compliance requirements inferred from domain */
  compliance: ComplianceRequirement[];
  /** External integrations detected or inferred */
  integrations: ExternalIntegration[];
  /** Domain-specific keywords extracted from code */
  keywords: string[];
  /** Confidence level of domain inference (0-1) */
  confidence: number;
}

export interface BusinessEntity {
  name: string;
  source: string; // file path where detected
  fields: string[];
  relationships: string[];
  layer: 'model' | 'entity' | 'schema' | 'dto' | 'unknown';
}

export interface ComplianceRequirement {
  name: string; // e.g., 'LGPD', 'HIPAA', 'PCI-DSS', 'SOX', 'GDPR'
  reason: string;
  mandatoryChecks: string[];
}

export interface ExternalIntegration {
  name: string;
  type: 'api' | 'database' | 'queue' | 'storage' | 'payment' | 'auth' | 'government' | 'other';
  detectedFrom: string;
}

/**
 * Detailed module information extracted from project analysis.
 */
export interface ModuleDetail {
  name: string;
  path: string;
  files: string[];
  fileCount: number;
  lineCount: number;
  description: string;
  hasTests: boolean;
  testFiles: string[];
  entities: string[];
  controllers: string[];
  services: string[];
  layer: string;
}

/**
 * API endpoint detected from route/controller files.
 */
export interface DetectedEndpoint {
  method: string; // GET, POST, PUT, DELETE, PATCH
  path: string;
  file: string;
  handler: string;
  hasAuth: boolean;
  hasValidation: boolean;
}

/**
 * Detected framework with version, detected from dependency files.
 */
export interface FrameworkInfo {
  /** Framework name (e.g., 'FastAPI', 'NestJS', 'Django', 'Spring Boot') */
  name: string;
  /** Detected version (e.g., '0.104.1') or null */
  version: string | null;
  /** Category of framework */
  category: 'web' | 'orm' | 'test' | 'lint' | 'build' | 'other';
  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * Detected toolchain — build, test, lint, run commands.
 */
export interface DetectedToolchain {
  /** Build command (e.g., 'npm run build', 'make build', 'mvn package') */
  buildCmd: string;
  /** Test command (e.g., 'pytest', 'npm test', 'go test ./...') */
  testCmd: string;
  /** Lint command (e.g., 'ruff check .', 'eslint .', 'golangci-lint run') */
  lintCmd: string;
  /** Run/dev command (e.g., 'uvicorn main:app', 'npm run dev') */
  runCmd: string;
  /** Coverage command */
  coverageCmd: string;
  /** Dependency install command */
  installCmd: string;
  /** Migration command (if applicable) */
  migrateCmd: string | null;
  /** Dependency file (e.g., 'requirements.txt', 'package.json') */
  depsFile: string;
}

/**
 * Enriched template context with domain awareness.
 */
export interface EnrichedTemplateContext extends TemplateContext {
  domain: DomainInsights;
  modules: ModuleDetail[];
  endpoints: DetectedEndpoint[];
  untestedModules: string[];
  criticalPaths: string[]; // files with highest coupling
  projectDepth: 'small' | 'medium' | 'large' | 'enterprise'; // drives template verbosity
  /** Detected frameworks with versions */
  detectedFrameworks: FrameworkInfo[];
  /** Primary web framework (e.g., 'FastAPI', 'NestJS', 'Django') */
  primaryFramework: FrameworkInfo | null;
  /** Detected toolchain commands */
  toolchain: DetectedToolchain;
  /** Real project structure pattern detected */
  projectStructure: 'clean-architecture' | 'mvc' | 'modular' | 'flat' | 'monorepo' | 'unknown';
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
